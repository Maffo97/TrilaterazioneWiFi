import asyncio
import websockets
import random
import sys
import socket
import sqlite3
from scapy.all import *
from scapy.layers.dot11 import Dot11
from colorama import Fore, Style
from datetime import datetime
from mac_vendor_lookup import MacLookup


indexDevice = 0

#query per la media
#SELECT macadress, AVG(rssi) media FROM ProbeRequest GROUP BY macadress


#nel mio ambiente casalingo il coefficiente di dispersione del segnale
#e dopo l'analisi dei dati l'RSSI medio a distanza di 1m è 37
pathLossC = 3

# creazione classe per i vendor e rispettivo RSSI d0
#########################################################
class VendorRSSId0:
    vendor = None
    RSSId0 = None
    def __init__(self, vendor, RSSId0):
        self.vendor = vendor
        self.RSSId0 = RSSId0
    def getVendor(self):
        return vendor

Apple = ("Apple, Inc.",-38.5)
Samsung = ("Samsung Electronics Co.,Ltd",-31)

Vendor = [Apple,Samsung]
#########################################################

# calcolo della distanza 
#########################################################
def distance(vendor, RSSI):
    RSSId0 = -37
    for x in Vendor:
        if(vendor == x[0]):
            RSSId0 = x[1]
            break

    #print(str(RSSI) + " " + vendor + " " + str(RSSId0) + " " + str(pathLossC))
    return pow(10,((RSSId0 - RSSI)/(10*pathLossC)))

# metodo per scoprire il vendor in base al mac adress
#########################################################
def findVendor(macAdress):
    mac = MacLookup()
    try:
        return mac.lookup(macAdress)
    except:
        pass
#########################################################

#A function to apply trilateration formulas to return the (x,y) intersection point of three circles
#########################################################
def trilateration(x1,y1,r1,x2,y2,r2,x3,y3,r3):
  A = 2*x2 - 2*x1
  B = 2*y2 - 2*y1
  C = r1**2 - r2**2 - x1**2 + x2**2 - y1**2 + y2**2
  D = 2*x3 - 2*x2
  E = 2*y3 - 2*y2
  F = r2**2 - r3**2 - x2**2 + x3**2 - y2**2 + y3**2
  x = (C*E - F*B) / (E*A - B*D)
  y = (C*D - A*F) / (B*D - A*E)
  return x,y
#########################################################


# metodo per sapere l'orario
#########################################################
def tempo():
    return str(datetime.now().strftime("%H:%M:%S"))
#########################################################

# Creazione del database
#########################################################
try:
    sqliteConnection = sqlite3.connect("trilaterazione.db")
    cursor = sqliteConnection.cursor()
    sqlite_create_table_query = '''CREATE TABLE Dispositivi (
                                ID INTEGER PRIMARY KEY NOT NULL,
                                nome CHAR(20) NOT NULL,
                                latitudine FLOAT NOT NULL,
                                longitudine FLOAT NOT NULL,
                                UNIQUE(latitudine,longitudine))'''
    cursor.execute(sqlite_create_table_query)
    sqliteConnection.commit()
    sqlite_create_table_query = '''CREATE TABLE ProbeRequest (
                                macAdress TEXT NOT NULL,
                                nodeID INTEGER NOT NULL,
                                rssi REAL NOT NULL,
                                distance FLOAT NOT NULL,
                                vendor TEXT,
                                ts DATETIME NOT NULL,
                                UNIQUE(macAdress, rssi, nodeID),
                                FOREIGN KEY(nodeID) REFERENCES Dispositivi(ID))'''
    cursor.execute(sqlite_create_table_query)
    sqliteConnection.commit()
    print(Fore.GREEN + "[SERVER][" + tempo() + "]: Record inserito correttamente nel database, numero di righe: " +
          Fore.RESET, cursor.rowcount)
    cursor.close()


except sqlite3.Error as error:
    print(Fore.RED +
          "[SERVER][" + tempo() + "]: Errore durante l'esecuzione dello script sql" + Fore.RESET, error)
finally:
    if (sqliteConnection):
        sqliteConnection.close()
        # print(Fore.GREEN + "[Server][" + tempo() + "]:Connessione con sqlite terminata" + Fore.RESET)
#########################################################


# Inizializzazione socket
#########################################################
ipAddress = socket.gethostbyname(socket.gethostname())
interface = "wlx00c0caa71dd5"
port = 8888
#########################################################

# Debug
###############################SELECT macadress, AVG(rssi) media FROM ProbeRequest GROUP BY macadress##########################
print(f"[From server]:IP Address: {str(ipAddress)}")
print(f"[From server]:Interface: {str(interface)}")
print(f"[From server]:Port: {str(port)}")
#########################################################

# Medodo che permette il collegamento al db e l'esecuzione della query
#########################################################
def executeQuery(query, data):
    global indexDevice
    Flag = True
    try:
        sqliteConnection = sqlite3.connect("trilaterazione.db")
        cursor = sqliteConnection.cursor()
        # print("Successfully Connected to SQLite")
        if data is None:
            cursor.execute(query)
            try:
                indexDevice = cursor.fetchall()
            except sqlite3.Error as error:
                print(Fore.RED + "[SERVER][" + tempo() +
                      "]: Errore durante l'esecuzione dello script" + Fore.RESET, error)
        else:
            cursor.execute(query, data)
        sqliteConnection.commit()
        print(Fore.GREEN + "[SERVER][" + tempo() + "]: Query eseguita correttamente, numero di righe:" + Fore.RESET,
              cursor.rowcount)
        cursor.close()
        return Flag
    except sqlite3.Error as error:
        Flag = False
        print(Fore.RED + "[SERVER][" + tempo() +
              "]: Errore durante l'esecuzione dello script" + Fore.RESET, error)
        return Flag
    finally:
        if (sqliteConnection):
            sqliteConnection.close()
            # print(#Fore.GREEN + "[SERVER][" + tempo() + "]:Connessione con sqlite terminata" + Fore.RESET)
#########################################################

#packet handler
#########################################################
def PacketHandler(pkt):
    if pkt.haslayer(Dot11ProbeReq):
        dot11Layer = pkt.getlayer(Dot11)
        macAdr = str(dot11Layer.addr2)
        RSSI = pkt.dBm_AntSignal
        time = datetime.now().strftime("%d/%m/%y-%H:%M:%S")
        
        nodeID = indexDevice[0][0]
        vendor = findVendor(macAdr)
        dst = distance(vendor, RSSI)

        query = "INSERT INTO ProbeRequest(macAdress, nodeID, rssi, distance, vendor, ts) VALUES (?,?,?,?,?,?)"
        data = (macAdr, nodeID, RSSI, dst, vendor, time)
        executeQuery(query, data)     
#########################################################


# Ricezione pacchetti dal client
#########################################################
async def echo(websocket, path):
    async for message in websocket:
        # print(f"[From client]: {message}")
        protocol = message.split("-")[0]

        # inserimento dati nel database
        #########################################################
        if protocol == "$insert":
            query = message.split("-")[1]
            lat = message.split("-")[2]
            lng = message.split("-")[3]
            nome = message.split("-")[4]
            data = (nome, lat, lng)
            print("[CLIENT][" + tempo() + "]: INSERT INTO DB nome:" + nome +
                  " latitudine: " + lat + " longitudine: " + lng)
            if(executeQuery(query, data)):
                await websocket.send("$insert:200:OK")
            else:
                await websocket.send("$400:Bad Request")
        #########################################################

        # eliminazione dati dal database
        #########################################################
        if protocol == "$delete":
            query = message.split("-")[1]
            data = None
            print("[CLIENT][" + tempo() + "]: DELETE FROM Dispositivi")
            if(executeQuery(query, data)):
                await websocket.send("$200:OK")
            else:
                await websocket.send("$400:Bad Request")
        #########################################################

        # inizio scansione e inserimento dei dati nel database
        #########################################################
        if protocol == "$scan":     
            timer = 60 
            query = message.split("-")[1]
            data = None
            if(executeQuery(query, data)):
                await websocket.send("$200:OK")
            else:
                await websocket.send("$400:Bad Request")
            msg = "[CLIENT][{}]:Scan del dispositivo: {} per {} secondi"
            print(msg.format(tempo(),str(indexDevice[0][0]),timer))
            
           

            t = AsyncSniffer(iface = interface, prn = PacketHandler)
            t.start()
            time.sleep(timer)
            t.stop() 

            print("[SERVER][" + tempo() + "]: scansione terminata")


            #tempo = int(attributes)
            # print(t)   
        #########################################################


asyncio.get_event_loop().run_until_complete(
    websockets.serve(echo, '127.0.0.1', port))
asyncio.get_event_loop().run_forever()
##########################################RED###############
