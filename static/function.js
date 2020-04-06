

//variabile socket e layergroup
//---------------------------------------------------------------------
var socket = null;
var markers = L.layerGroup();
var cMarkers = L.layerGroup();
var clusterMarkers = L.markerClusterGroup();
var buttonCounter = 1;
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
    };
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
            console.log(wsMsg);

        } else if(wsMsg.split('-')[0] == "$pos"){
            var lng = wsMsg.split('-')[1];
            var lat = wsMsg.split('-')[2];
            var macAdr = wsMsg.split('-')[3];
            var vendor = wsMsg.split('-')[4];
            var mark = createCustomMarker(macAdr, lat, lng).addTo(clusterMarkers);
            clusterMarkers.addTo(map);
        }       
        else{
            if (wsMsg.split(':')[0] == "$200") {
                console.log(wsMsg.substring(1));
            }
            else {
                alert(wsMsg.substring(1));
                console.log(wsMsg.substring(1));
            }

        }

    };
}
//---------------------------------------------------------------------

//trova la posizione del dispositivo
//---------------------------------------------------------------------
function getLocation() {
    var lat = document.getElementById("lat");
    var lng = document.getElementById("lng");
    var map = document.getElementById("map");
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(showPosition);
    } else {
        alert("Geolocalizzazione non supportata da questo browser");
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
    markers = L.layerGroup([createMarker(latitude, longitude)]).addTo(map);
}
//---------------------------------------------------------------------

//crea un marker da aggiungere alla mappa 
//---------------------------------------------------------------------
function createMarker(latitude, longitude) {
    var marker = new L.Marker([latitude, longitude], { draggable: true });
    marker.bindPopup('<p>Trascina per correggere \n la posizione</p>');
    marker.on('mouseover', function (e) {
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
    return marker;
}
//---------------------------------------------------------------------

//rimuove i dispositivi all'interno del database 
//--------------------------------------------------------------------
function removeDevice() {
    if (socket.readyState == 1) {
        if (confirm("Sei sicuro di rimuovere definitivamente tutti i dispositivi all'interno del database?")) {
            socket.send("$delete-DELETE FROM Dispositivi");
            var table = document.getElementById("tabellaDispositivi");
            cMarkers.clearLayers();
            console.log(table.rows.length);
            while (table.rows.length != 1) {
                table.deleteRow(table.rows.length - 1)
            }
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
                        + lat + "-" + lng + "-Dispositivo");
                }
                else {
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
function createCustomMarker(nome, lat, lng) {
    var redMarker = L.icon({
        iconUrl: 'static/redMarker.png',
        iconSize: [10, 10], // size of the icon
    });
    var marker = new L.Marker([lat, lng], { icon: redMarker, draggable: false });
    marker.bindPopup(nome);
    marker.on('mouseover', function (e) {
        this.openPopup();
    });
    marker.on('mouseout', function (e) {
        this.closePopup();
    });
    return marker;
}
//---------------------------------------------------------------------

//funzione che da inizio alla scansione dei pacchetti circostanti
//---------------------------------------------------------------------
function WiFi(id) {
    if (socket.readyState == 1) {
        print(id)
        realID = id.split('-')[1]
        print(realID)
        socket.send("$scan-" + realID);
    }

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

    //creazione della checkbox indoor 
    var checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.id = "check-" + buttonCounter;

    //creazione input type number
    var x = document.createElement("INPUT");
    x.setAttribute("type", "number");
    x.value = 60;
    x.style.width = "50px";
    x.id = "time-" + buttonCounter;

    //creazione pulsante avvio scansione
    var button = document.createElement("INPUT");
    button.setAttribute("type", "submit");
    button.value = "inizia scansione";
    button.id = "btn-" + buttonCounter;
    button.onclick = function () { WiFi(button.id) };




    cell2.innerHTML = lat;
    cell3.innerHTML = lng;
    cell4.appendChild(checkbox);
    cell5.appendChild(x);
    cell6.appendChild(button);
    if (nome.trim() == "") {
        nome = "Dispositivo " + buttonCounter;
    }

    cell1.innerHTML = "Dispositivo " + buttonCounter;
    var mark = createCustomMarker(nome, lat, lng).addTo(cMarkers);
    cMarkers.addTo(map);
    buttonCounter++;

}