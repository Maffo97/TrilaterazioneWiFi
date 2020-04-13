

//variabile socket e layergroup
//---------------------------------------------------------------------
var bigAntenna = L.layerGroup();
var bigPhone = L.layerGroup();
var socket = null;
var markers = L.layerGroup();
var antennaMarkers = L.layerGroup();
var phoneMarkers = L.layerGroup();
var gifMarker = L.layerGroup();
var buttonCounter = 1;
var homeUrl = "static/home.png";
var antennaUrl = "static/antenna.png";
var phoneUrl = "static/phone.png";
var pulseUrl = "static/pulse.gif"
var antennaDim = [30, 23]
var homeDim = [45, 50]
var phoneDim = [20, 20]
var pulseDim = [70, 70]
//---------------------------------------------------------------------


//funzione per la connessione al socket. Viene avviata tramite l'onload del body della pagina html
//con i vari metodi on open e on message.
//---------------------------------------------------------------------
async function connect() {

    var btn = document.getElementById("btn");
    var elimina = document.getElementById("elimina");
    var find = document.getElementById("findCoordinate");
    btn.disabled = false;
    elimina.disabled = false;
    find.disabled = false;

    var ipaddress = "127.0.0.1";
    var port = 8888;
    socket = new WebSocket("ws:" + ipaddress + ":" + port);

    socket.onopen = function (event) {
        socket.send("$db-SELECT * FROM Dispositivi");
        console.log("Connessione col server effettuata");
    }
    socket.onmessage = function (messageEvent) {
        var wsMsg = messageEvent.data;
        if (wsMsg.split(':')[0] == "$insert") {
            if (wsMsg.split(':')[1] == "200") {
                console.log(wsMsg.substring(7));
                var lat = document.getElementById("lat").value;
                var lng = document.getElementById("lng").value;
                var nome = document.getElementById("nome").value;
                createRow(lat, lng, nome);
            }
        } else if (wsMsg.split('-')[0] == "$db") {
            var lat = wsMsg.split('-')[3];
            var lng = wsMsg.split('-')[4];
            var nome = wsMsg.split('-')[2];
            createRow(lat, lng, nome);
            map.setView([lat, lng], 19);
            //console.log(wsMsg);

        } else if (wsMsg.split('-')[0] == "$pos") {
            var lng = wsMsg.split('-')[1];
            var lat = wsMsg.split('-')[2];
            var macAdr = wsMsg.split('-')[3];
            var vendor = wsMsg.split('-')[4];
            var text = vendor;
            createRowTableTrilateration(macAdr, lat, lng, vendor);
            phoneMarkers.addLayer(createCustomMarker(text, lat, lng, phoneUrl, false, phoneDim, false));
            phoneMarkers.addTo(map);

        } else if (wsMsg == "$end") {
            gifMarker.clearLayers();
        }
        else if (wsMsg.split('-')[0] == "$ts") {
            console.log(wsMsg);
            data = (wsMsg.split('-')[1]).split('/');
            var data = data[1] + "/" + data[0] + "/" + data[2] + "-" + wsMsg.split('-')[2];
            window.localStorage.setItem("Ultima scansione", data);
        }
        else {
            if (wsMsg.split(':')[0] == "$200") {
                console.log(wsMsg.substring(1));
            }
            else {
                alert(wsMsg.substring(1));
                //console.log(wsMsg.substring(1));
            }

        }

    }
}
//---------------------------------------------------------------------

//trova la posizione del dispositivo
//---------------------------------------------------------------------
function getLocation() {
    var lat = document.getElementById("lat");
    var lng = document.getElementById("lng");
    var map = document.getElementById("map");
    try {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(showPosition);
        } else {
            alert("Geolocalizzazione non supportata da questo browser");
        }
    }
    catch{
        text = "Trascina per correggere \n la posizione"
        markers = L.layerGroup([createCustomMarker(text, 45, 10, homeUrl, true, homeDim, false)]).addTo(map);
    }

}
//---------------------------------------------------------------------


//inserisce un marker sulla mappa con coordinate precedentemente trovate
//---------------------------------------------------------------------
function showPosition(position) {
    var latitude = position.coords.latitude;
    var longitude = position.coords.longitude;
    lat.value = latitude;
    lng.value = longitude;
    map.setView([position.coords.latitude, position.coords.longitude], 19);
    markers.clearLayers();
    text = "Trascina per correggere \n la posizione"
    markers = L.layerGroup([createCustomMarker(text, latitude, longitude, homeUrl, true, homeDim, false)]).addTo(map);
}
//---------------------------------------------------------------------

//rimuove i dispositivi all'interno del database 
//--------------------------------------------------------------------
function removeDevice() {
    if (socket.readyState == 1) {
        if (confirm("Sei sicuro di rimuovere definitivamente tutti i dispositivi all'interno del database?\
        Verranno cancellati anche i dati delle rilevazioni")) {
            socket.send("$delete-DELETE FROM Dispositivi, ProbeRequest");
            var table = document.getElementById("tabellaDispositivi");
            antennaMarkers.clearLayers();
            //console.log(table.rows.length);
            while (table.rows.length != 1) {
                table.deleteRow(table.rows.length - 1)
            }
            buttonCounter = 1;
        }
    }
}

//aggiunge un dispositivo all'interno del database 
//---------------------------------------------------------------------
function addDevice() {
    var lat = document.getElementById("lat").value;
    var lng = document.getElementById("lng").value;
    var nome = document.getElementById("nome").value;
    if (socket.readyState == 1) {
        //socket.send("Aggiunta dispositivo");
        if (lat != null && lng != null) {
            if (lat != "" && lng != "") {
                if (nome.trim() == "") {
                    socket.send("$insert-INSERT INTO Dispositivi(nome, latitudine, longitudine) VALUES(?,?,?)-"
                        + lat + "-" + lng + "-Dispositivo " + buttonCounter);
                }
                else {
                    var map = L.map('map').setView([mylat, mylong], myzoom);
                    socket.send("$insert-INSERT INTO Dispositivi(nome, latitudine, longitudine) VALUES(?,?,?)-"
                        + lat + "-" + lng + "-" + nome);
                }
            }
            else {
                alert("Inserisci latitudine e longitudine");
            }

        }
        else {
            alert("inserisci latitudine e longitudine");
        }
    }
    else {
        //console.log(socket.readyState);
        console.log("impossibile connettersi al server, tentativo di riconnessione");
        if (confirm("Impossibile accedere al database, tentare una riconnessione?")) {
            connect();
        }
    }
}
//---------------------------------------------------------------------


//crea un marker tramite l'utilizzo di una immagine png per segnalare le posizioni
//dei dispositivi
//---------------------------------------------------------------------
function createCustomMarker(text, latitudine, longitudine, iconUrl, drag, dim, pulse) {
    if (!pulse) {
        var cMark = L.icon({
            iconUrl: iconUrl,
            iconSize: dim, // size of the icon
            iconAnchor: [dim[0] / 2, dim[1]]

        });
    }
    else {
        var cMark = L.icon({
            iconUrl: iconUrl,
            iconSize: dim, // size of the icon
            iconAnchor: [dim[0] / 2, dim[1] - 12]

        });
    }
    var marker = new L.Marker([latitudine, longitudine], { icon: cMark, draggable: drag });
    if (!pulse) {
        marker.bindPopup(text);
        marker.on('click', function (e) {
            this.openPopup();
        });
        marker.on('mouseout', function (e) {
            this.closePopup();
        });
        marker.on("drag", function (e) {
            var marker = e.target;
            var position = marker.getLatLng();
            lat.value = position.lat;
            lng.value = position.lng;
        });
    }
    return marker;
}
//---------------------------------------------------------------------

//funzione che da inizio alla scansione dei pacchetti circostanti
//---------------------------------------------------------------------
function WiFi(id, lat, lng, time) {
    if (socket.readyState == 1) {
        now = new Date();
        var last = new Date(window.localStorage.getItem("Ultima scansione"))
        if (now - last >= 600000) {
            if (confirm("ultima scansione effettuata " + parseInt((now - last)/3600000) + " ore fa:\n" +
            "i dati raccolti potrebbero essere non veritieri, continuare comunque?")) {
                    startScan(time,id,lat,lng);
            }
        }
        else{
            startScan(time,id,lat,lng);
        }
    }
}

function startScan(time, id, lat,lng){
    ProgressBar(time);
    gifMarker.clearLayers();
    realID = id.split('-')[1];
    socket.send("$scan-" + realID + "-" + time);
    var mark = createCustomMarker("", lat, lng, pulseUrl, false, pulseDim, true).addTo(gifMarker);
    gifMarker.addTo(map);
    phoneMarkers.clearLayers();
    var table = document.getElementById("dispositiviTrilaterati");
    while (table.rows.length != 1) {
        table.deleteRow(table.rows.length - 1)
    }
    localStorage.setItem("Ultima scansione", new Date());
}
//---------------------------------------------------------------------

async function createRow(lat, lng, nome) {
    //creazione delle righe per nome
    var table = document.getElementById("tabellaDispositivi");
    var row = table.insertRow(1);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    var cell3 = row.insertCell(2);
    var cell4 = row.insertCell(3);
    var cell5 = row.insertCell(4);
    var cell6 = row.insertCell(5);

    //creazione input type number
    var x = document.createElement("INPUT");
    x.setAttribute("type", "number");
    x.value = 60;
    x.style.width = "50px";
    x.id = "time-" + buttonCounter;

    //creazione pulsante avvio scansione
    var bStart = document.createElement("input");
    bStart.setAttribute("type", "submit");
    bStart.setAttribute("class", "btn btn-success");
    bStart.value = "Inizia scansione";
    bStart.id = "btn-" + buttonCounter;
    bStart.style.padding = "2px";
    bStart.style.fontSize = "1.1vw";

    cell2.innerHTML = lat;
    cell3.innerHTML = lng;
    cell4.appendChild(x);
    cell5.appendChild(bStart);

    bStart.onclick = function () { WiFi(bStart.id, cell2.innerHTML, cell3.innerHTML, x.value) };
    if (nome.trim() == "") {
        nome = "Dispositivo " + buttonCounter;
    }

    cell1.innerHTML = nome;
    var mark = createCustomMarker(nome, lat, lng, antennaUrl, false, antennaDim, false).addTo(antennaMarkers);
    row.addEventListener('mouseover', function (e) {
        mark.bindTooltip(nome)
        mark.openTooltip();
    });
    row.addEventListener('mouseout', function (e) {
        bigAntenna.clearLayers();
        mark.closeTooltip();
    });
    antennaMarkers.addTo(map);
    buttonCounter++;

}

//creazione della tabella per i dispositivi che sono stati trovati sulla mappa
//dopo la trilaterazione
function createRowTableTrilateration(macAdr, lat, lng, vendor) {
    var table = document.getElementById("dispositiviTrilaterati");
    var row = table.insertRow(1);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    var cell3 = row.insertCell(2);
    var cell4 = row.insertCell(3);
    row.addEventListener('mouseover', function (e) {
        var mark = createCustomMarker("", lat, lng, phoneUrl, false, [50, 60], false).addTo(bigPhone);
        mark.bindTooltip("<strong>Indirizzo Mac:</strong> " + macAdr + " <br>" + "<strong>vendor:</strong> " + vendor)
        bigPhone.addTo(map);
        mark.openTooltip();
        phoneMarkers.hide();
    });
    row.addEventListener('mouseout', function (e) {
        bigPhone.clearLayers();
        mark.closeTooltip();
    });
    cell1.innerHTML = macAdr;
    cell2.innerHTML = vendor;
    cell3.innerHTML = lat;
    cell4.innerHTML = lng;
}


//funzione per la progressione della barra di caricamento durante la scansione
async function ProgressBar(timer) {
    var div = 100 / timer;
    percent = 0;

    var counterBack = setInterval(function () {
        percent += div;
        if (percent <= 100) {
            document.getElementById("PBar").style.width = 0 + percent + "%";
            document.getElementById("PBar").innerHTML = "Scansione in corso";
        } else {
            clearTimeout(counterBack);
            document.getElementById("PBar").style.width = 0;
        }

    }, 1000);
}

