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
devices = set()
dev = set()

#query per la media
#SELECT macadress, AVG(rssi) media FROM ProbeRequest GROUP BY macadress

# creazione classe per i device che vengono trovati
#########################################################
class WiFidevice:
    def __init__(self, macAddr, dbm):
        self.macAddr = macAddr
        self.dbm = dbm
#########################################################

def findVendor(macAdress):
    mac = MacLookup()
    try:
        return mac.lookup(macAdress)
    except:
        pass

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
        time = datetime.now().strftime("%d/%m/%y-%h:%m:%s")
        distance = 0
        nodeID = indexDevice[0][0]
        vendor = findVendor(macAdr)

        query = "INSERT INTO ProbeRequest(macAdress, nodeID, rssi, distance, vendor, ts) VALUES (?,?,?,?,?,?)"
        data = (macAdr, nodeID, RSSI, distance, vendor, time)
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
