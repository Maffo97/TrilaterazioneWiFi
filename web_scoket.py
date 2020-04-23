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
from scipy.optimize import minimize
import numpy as np
import localization as lx


# variabili globali utilizzate durante l'esecuzione del programma
#########################################################
coorde = []
coords = []
dst = []
listaDati = []
indexDevice = 0
ID = 1
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


# nel mio ambiente casalingo il coefficiente di dispersione del segnale
# e dopo l'analisi dei dati l'RSSI medio a distanza di 1m è 30
pathLossC = 4.61

# classe per i dati del risultato della query che cerca almeno 3 rilevazioni
# di un singolo dispositivo
#########################################################


class DatiTrilaterazione:
    def __init__(self, macAdr, dist, vendor, lat, lng):
        self.macAdr = macAdr
        self.dist = dist
        self.vendor = vendor
        self.lat = lat
        self.lng = lng

# creazione classe per i vendor e rispettivo RSSI d0
#########################################################

# classe per i vendor e il rispettivo RSSI a 1mt
#########################################################


class VendorRSSId0:
    vendor = None
    RSSId0 = None
    def __init__(self, vendor, RSSId0):
        self.vendor = vendor
        self.RSSId0 = RSSId0

    def getVendor(self):
        return vendor


Apple = ("Apple, Inc.", -30)
Samsung = ("Samsung Electronics Co.,Ltd", -28)

Vendor = [Apple, Samsung]
#########################################################

# calcolo della distanza
#########################################################


def distance(vendor, RSSI):
    RSSId0 = -29
    for x in Vendor:
        if(vendor == x[0]):
            RSSId0 = x[1]
            break

    #print(str(RSSI) + " " + vendor + " " + str(RSSId0) + " " + str(pathLossC))
    return pow(10, ((RSSId0 - RSSI)/(10*pathLossC)))

# metodo per scoprire il vendor in base al mac adress
#########################################################


def findVendor(macAdress):
    mac = MacLookup()
    try:
        return mac.lookup(macAdress)
    except:
        pass
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
                                indoor INTEGER NOT NULL,
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
            try:
                indexDevice = cursor.fetchall()
            except sqlite3.Error as error:
                print(Fore.RED + "[SERVER][" + tempo() +
                      "]: Errore durante l'esecuzione dello script" + Fore.RESET, error)
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

# packet handler
#########################################################


def PacketHandler(pkt):
    if pkt.haslayer(Dot11ProbeReq):
        dot11Layer = pkt.getlayer(Dot11)
        macAdr = str(dot11Layer.addr2)
        RSSI = pkt.dBm_AntSignal
        time = datetime.now().strftime("%d/%m/%y-%H:%M:%S")

        nodeID = ID
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
        #print(f"[From client]: {message}")
        protocol = message.split("-")[0]


        if protocol == "$id":
            query = message.split("-")[1]
            data = None
            print("[CLIENT][" + tempo() + "]: " + query)
            if(executeQuery(query, data)):
                await websocket.send("$id-" + str(indexDevice[0][0]))
            else:
                await websocket.send("$400:Bad Request")

        # inserimento dati nel database
        #########################################################
        if protocol == "$insert":
            query = message.split("-")[1]
            lat = message.split("-")[2]
            lng = message.split("-")[3]
            nome = message.split("-")[4]
            indoor = message.split("-")[5]
            data = (nome, lat, lng, indoor)
            print("[CLIENT][" + tempo() + "]: INSERT INTO DB nome:" + nome +
                  " latitudine: " + lat + " longitudine: " + lng + "indoor: " + indoor)
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
            print("[CLIENT][" + tempo() + "]: " + query)
            if(executeQuery(query, data)):
                await websocket.send("$200:OK")
            else:
                await websocket.send("$400:Bad Request")
        #####################################################localStorage.setItem('myCat', 'Tom');####

        # inizio scansione e inserimento dei dati nel database
        #########################################################
        if protocol == "$scan":
            global dst
            global coords
            global listaDati
            global ID
            ID = message.split("-")[1]
            timer = int(message.split("-")[2])
            indoor = message.split("-")[3]
            data = None
            msg = "[CLIENT][{}]: Scan del dispositivo: {} per {} secondi"
            print(msg.format(tempo(), str(ID), timer))

            t = AsyncSniffer(iface=interface, prn=PacketHandler)
            t.start()
            time.sleep(timer)
            t.stop()

            print("[SERVER][" + tempo() + "]: scansione terminata")
            await websocket.send("$end")

            query = "select macadress FROM(SELECT * FROM ProbeRequest JOIN Dispositivi on Dispositivi.ID == ProbeRequest.nodeID " + \
                      "WHERE Dispositivi.indoor = " + indoor + " " + \
                      "GROUP by macadress, nodeid ) GROUP by macadress HAVING COUNT(macadress) >= 3"
            data = None
            if(executeQuery(query, data)):
                for x in indexDevice:
                    for y in x:
                        query = "select macadress, nodeid, distance, vendor, latitudine, longitudine from ProbeRequest join Dispositivi on ProbeRequest.nodeID = Dispositivi.id where ProbeRequest.macadress = '" + \
                              y+"' and Dispositivi.indoor == " + indoor
                        #query = "select macadress,nodeid, avg(distance), vendor, latitudine, longitudine from ProbeRequest " +\
                               # "join Dispositivi on ProbeRequest.nodeID = Dispositivi.id " + \
                               # "where ProbeRequest.macadress = '" + y +"' and Dispositivi.indoor == " + indoor + " "  + \
                               # "GROUP BY nodeid"
                        try:                          
                            if(executeQuery(query, data)):
                                vendor = None
                                x = False
                                anchor = []
                                measure = []
                                for z in indexDevice:
                                    print(z)
                                    x = True
                                    vendor = z[3]
                                    macAdr = z[0]
                                    #P.add_anchor(str(z[2]),(float(z[5]),float(z[4])))
                                    anchor.append([str(z[1]),float(z[5]),float(z[4])])
                                    print(indoor)
                                    if indoor == str(1):
                                        #t.add_measure(str(z[2]),float(z[2])) #10 per la scala indoor
                                        measure.append([str(z[1]),float(z[2])])
                                    else:
                                        #t.add_measure(str(z[2]),float(z[2]*(10**-5)))
                                        measure.append([str(z[1]),float(z[2])*(10**-5)]) #10**-5 per la mappa           
                                if(vendor == None):
                                    vendor = "Vendor non riconosciuto"

                                if x:
                                    P = lx.Project(mode='2D',solver='LSE')
                                    for h in anchor:
                                        P.add_anchor(str(h[0]),(float(h[1]),float(h[2])))
                                    
                                    t,label = P.add_target()

                                    for s in measure:
                                        t.add_measure(str(s[0]),float(s[1]))

                                    
                                    P.solve()
                                    p = t.loc
                                    print(p.x,p.y)
                                    await websocket.send("$pos&"+str(p.x)+"&"+str(p.y)+"&"+macAdr+"&"+vendor+"&"+indoor)
                                else:
                                    await websocket.send("$pos&nessun riscontro trovato")
                                
                        except IndexError as e:
                            print(
                                Fore.RED+ "[SERVER][" + tempo() + "]: " + Fore.RESET, e)
                        '''except:
                            print(
                                Fore.RED+"[SERVER][" + tempo() + "]: Errore sconosciuto" + Fore.RESET)'''
            else:
                print(
                    Fore.RED+"[SERVER][" + tempo() + "]: Nessun Riscontro trovato nella trilaterazione" + Fore.RESET)
        #########################################################

        # invio dei dati presenti nel database
        #########################################################
        if protocol == "$db":
            query = message.split("-")[1]
            indoor = message.split("=")[1]
            data = None
            print("[CLIENT][" + tempo() + "]: " + query)
            if(executeQuery(query, data)):
                data = ""
                for x in indexDevice:
                    for y in x:
                        data = data + "-" + str(y)                     
                    await websocket.send("$db" + data)
                    data = ""
            else:
                await websocket.send("$400:BadRequest")

            query = "SELECT  MAX(ts) FROM ProbeRequest JOIN Dispositivi ON ProbeRequest.nodeID = Dispositivi.id " + \
                    "where Dispositivi.indoor = " + indoor
            data = None
            if(executeQuery(query, data)):
                await websocket.send("$ts-" + str(indexDevice[0][0]))
            else:
                await websocket.send("$400:BadRequest")

        #########################################################

asyncio.get_event_loop().run_until_complete(
    websockets.serve(echo, '127.0.0.1', port))
asyncio.get_event_loop().run_forever()
##########################################RED###############
