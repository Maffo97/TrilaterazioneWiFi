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

indexDevice = 0


# creazione classe per i device che vengono trovati
#########################################################
class WiFidevice:
    def __init__(self, macAddr, dbm):
        self.macAddr = macAddr
        self.dbm = dbm
#########################################################

# metodo per sapere l'orario
#########################################################
def tempo():
    return str(datetime.now().strftime("%H:%M:%S"))
#########################################################

#packet handler
#########################################################
devices = set()
def PacketHandler(pkt):
    if pkt.haslayer(Dot11ProbeReq):

        print(pkt.dBm_AntSignal)
        dot11_layer = pkt.getlayer(Dot11)
                            
        if dot11_layer.addr2 and (dot11_layer.addr2 not in devices):
            devices.add(dot11_layer.addr2)
            dev.add(WifiDevice(dot11_layer.addr2,str(pkt.dBm_AntSignal)))
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
                                macAdress CHAR(48) PRIMARY KEY NOT NULL,
                                vendor CHAR(20),
                                nodeID INTEGER NOT NULL,
                                rssi REAL NOT NULL,
                                ts TIME NOT NULL,
                                FOREIGN KEY(nodeID) REFERENCES Dispositivi(ID))'''
    cursor.execute(sqlite_create_table_query)
    sqliteConnection.commit()
    print(Fore.GREEN + "[Server][" + tempo() + "]: Record inserito correttamente nel database, numero di righe: " +
          Fore.RESET, cursor.rowcount)
    cursor.close()


except sqlite3.Error as error:
    print(Fore.RED +
          "[Server][" + tempo() + "]: Errore durante l'esecuzione dello script sql" + Fore.RESET, error)
finally:
    if (sqliteConnection):
        sqliteConnection.close()
        # print(Fore.GREEN + "[Server][" + tempo() + "]:Connessione con sqlite terminata" + Fore.RESET)
#########################################################


# Inizializzazione socket
#########################################################
ipAddress = socket.gethostbyname(socket.gethostname())
interface = "wlan0"
port = 8888
#########################################################

# Debug
#########################################################
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
                print(Fore.RED + "[Server][" + tempo() +
                      "]: Errore durante l'esecuzione dello script" + Fore.RESET, error)
        else:
            cursor.execute(query, data)
        sqliteConnection.commit()
        print(Fore.GREEN + "[Server][" + tempo() + "]: Query eseguita correttamente, numero di righe:" + Fore.RESET,
              cursor.rowcount)
        cursor.close()
        return Flag
    except sqlite3.Error as error:
        Flag = False
        print(Fore.RED + "[Server][" + tempo() +
              "]: Errore durante l'esecuzione dello script" + Fore.RESET, error)
        return Flag
    finally:
        if (sqliteConnection):
            sqliteConnection.close()
            # print(#Fore.GREEN + "[Server][" + tempo() + "]:Connessione con sqlite terminata" + Fore.RESET)
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
            print("[Client][" + tempo() + "]: INSERT INTO DB nome:" + nome +
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
            print("[Client][" + tempo() + "]: DELETE FROM Dispositivi")
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
            print("[Client][" + tempo() +
                  "]:Scan del dispositivo: " + str(indexDevice) + "per " + timer + " secondi")
            t = AsyncSniffer(iface=interface, prn=PacketHandler)
            t.start()
            tempo = int(attributes)
            time.sleep(timer)
            print(f"[scanning for]: {str(tempo)} seconds")
            t.stop()
            # print(t)

            await websocket.send("numDev$"+str(len(dev)))
            for d in dev:
                print(f"To client:" + "dev$"+d.macAddr + "---"+d.dbm)
                await websocket.send("dev$"+d.macAddr + "---"+d.dbm)
        #########################################################


asyncio.get_event_loop().run_until_complete(
    websockets.serve(echo, '127.0.0.1', port))
asyncio.get_event_loop().run_forever()
#########################################################
