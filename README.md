## Tabella dei contenuti
* [Informazioni generali](#informazioni-generali)
* [Tecnologie](#Tecnologie)
* [Setup](#setup)

## Informazioni generali
Questo progetto permette di effettuare la trilaterazione di dispositivi basati sugli standard IEEE 802.11. (WiFi) in ambienti indoor ed outdoor

## Tecnologie
Questo progetto è stato creato con l'utilizzo di:
* [Bootstrap](https://getbootstrap.com/) version: 4.4.1
* [Python](https://www.python.org/downloads/) version: 3.7.5
* [Scapy](https://scapy.readthedocs.io/en/latest/installation.html) version: 2.4.2
* [Flask](https://flask.palletsprojects.com/en/1.1.x/) version: 1.1.1 
* [localization](https://pypi.org/project/Localization/) version: 0.1.7
* libgeos++
* [colorama](https://pypi.org/project/colorama/) version: 0.4.3
	
## Setup
Per il corretto funzionamento di questa app, è necessario l'utilizzo di un antenna WiFi che disponga della modalità monitor. questo [link](https://null-byte.wonderhowto.com/how-to/buy-best-wireless-network-adapter-for-wi-fi-hacking-2019-0178550/) contiene alcune delle possibili soluzioni da acquistare.

I dispositivi sono plug-and-play ma necessitano una configurazione per passare alla modalità monitor.
Per prima cosa è necessario scoprire il nome del dispositivo tramite il comando 

```
$ iwconfig
```

Trovato il nome del dispositivo, nel nostro caso wlan1, abilitare la modalità monitor

```
$ sudo ifconfig wlan1 down
$ sudo iwconfig wlan1 mode monitor
$ sudo ifconfig wlan1 up
```
Per controllare se questo cambiamento è stato applicato, ripetere il primo comando e verificare che ci sia scritto mode:monitor 

Installare le rispettive librerie tramite il comando
```
$ pip3 install 
```

Inserire nella cartella static l'immagine della mappa indoor realizzata inn un formato immagine .pnj .jpeg .jpg .jpe, utilizzando un qualsiasi editor come [questo](https://floorplancreator.net/plan/demo#)

Modificare inserendo l' indirizzo ip del dispositivo il quale si vuole utilizzare e il nome dell'interfaccia di rete all'interno dei file __ init__.py e web_socket.py 

![demo](https://github.com/Maffo97/TrilaterazioneWiFi/blob/master/Screencast%202020-04-23%2019_03_41.gif?raw=true)

Avviare prima il server tramite il comando
```
$ python3 __init__.py
```

e successivamente il secondo script python
```
$ sudo python3 web_socket.py
```



