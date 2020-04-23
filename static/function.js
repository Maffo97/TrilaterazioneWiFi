

//variabile socket e layergroup
//---------------------------------------------------------------------
var bigAntenna = L.layerGroup();
var bigPhone = L.layerGroup();
var bigPhoneIndoor = L.layerGroup();
var socket = null;
var markers = L.layerGroup();
var antennaMarkers = L.layerGroup();
var phoneMarkers = L.layerGroup();
var antennaMarkersIndoor = L.layerGroup();
var phoneMarkersIndoor = L.layerGroup();
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
var indoorMap;
var leafletMap;
//---------------------------------------------------------------------



//---------------------------------------------------------------------



//---------------------------------------------------------------------

function CreateIndoorMap(lunghezza, altezza, path) {
    path = "/static/" + path;
    console.log(path);
    indoorMap = L.map('map1', {
        crs: L.CRS.Simple,
        maxZoom: 10,
        minZoom: 5
    });
    var bounds = [[0, 0], [altezza, lunghezza]];
    var image = L.imageOverlay(path, bounds).addTo(indoorMap);
    indoorMap.fitBounds(bounds);
    window.localStorage.setItem("IndoorMap", "true");
    socket.send("$db-SELECT * FROM Dispositivi WHERE indoor = 1");
    text = "Trascina per correggere <br> la posizione";
    markers = L.layerGroup([createCustomMarker(text, 0, 0, homeUrl, true, homeDim, false)]).addTo(indoorMap);
    indoorMap.setView([0, 0], 5);
}
function CreateLeafletMap() {
    var mylat = '41.86956';
    var mylong = '12.524414';
    var myzoom = '4';
    leafletMap = L.map('map').setView([mylat, mylong], myzoom);
    L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);
    window.localStorage.setItem("LeafletMap", "true");

}




//funzione per la connessione al socket. Viene avviata tramite l'onload del body della pagina html
//con i vari metodi on open e on message.
//---------------------------------------------------------------------
async function connect() {
    CreateLeafletMap();
    window.localStorage.setItem("LeafletMap", "false");
    window.localStorage.setItem("IndoorMap", "false");
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
        socket.send("$db-SELECT * FROM Dispositivi WHERE indoor =0");
        socket.send("$id-SELECT max(id) FROM Dispositivi");
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
                var indoor = document.getElementById("inlineRadio1").checked;
                if (indoor) {
                    indoor = 1;
                }
                else {
                    indoor = 0;
                }
                createRow(lat, lng, nome, indoor, buttonCounter);
            }
        } else if (wsMsg.split('-')[0] == "$id") {
            buttonCounter = parseInt(wsMsg.split('-')[1]) + 1;
            console.log(buttonCounter);
        } else if (wsMsg.split('-')[0] == "$db") {
            var lat = wsMsg.split('-')[3];
            var lng = wsMsg.split('-')[4];
            var nome = wsMsg.split('-')[2];
            var indoor = wsMsg.split('-')[5];
            var ID = wsMsg.split('-')[1];
            //console.log(ID);
            createRow(lat, lng, nome, indoor, ID);
            markers.clearLayers();
            text = "Trascina per correggere <br> la posizione"
            if (indoor == 1) {
                markers = L.layerGroup([createCustomMarker(text, lat, lng, homeUrl, true, homeDim, false)]).addTo(indoorMap);
                indoorMap.setView([lat, lng], 5);
            } else {
                markers = L.layerGroup([createCustomMarker(text, lat, lng, homeUrl, true, homeDim, false)]).addTo(leafletMap);
                leafletMap.setView([lat, lng], 18);
            }

            //console.log(wsMsg);

        } else if (wsMsg.split('&')[0] == "$pos") {
            if (wsMsg.split('&')[1] == "nessun riscontro trovato") {
                console.log(wsMsg.split[1]);
            }
            else {
                var lng = wsMsg.split('&')[1];
                var lat = wsMsg.split('&')[2];
                var macAdr = wsMsg.split('&')[3];
                var vendor = wsMsg.split('&')[4];
                var indoor = wsMsg.split('&')[5];
                var text = vendor;
                createRowTableTrilateration(macAdr, lat, lng, vendor, indoor);
                if (indoor == 1) {
                    phoneMarkersIndoor.addLayer(createCustomMarker(text, lat, lng, phoneUrl, false, phoneDim, false));
                    phoneMarkersIndoor.addTo(indoorMap);
                }
                else {
                    phoneMarkers.addLayer(createCustomMarker(text, lat, lng, phoneUrl, false, phoneDim, false));
                    phoneMarkers.addTo(leafletMap);
                }
            }

        } else if (wsMsg == "$end") {
            gifMarker.clearLayers();
        }
        else if (wsMsg.split('-')[0] == "$ts") {
            //console.log(wsMsg);
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
    leafletMap.setView([position.coords.latitude, position.coords.longitude], 19);
    markers.clearLayers();
    text = "Trascina per correggere \n la posizione"
    markers = L.layerGroup([createCustomMarker(text, latitude, longitude, homeUrl, true, homeDim, false)]).addTo(leafletMap);
}
//---------------------------------------------------------------------

//rimuove i dispositivi all'interno del database 
//--------------------------------------------------------------------
function removeDevice() {
    if (socket.readyState == 1) {
        if (confirm("Sei sicuro di rimuovere definitivamente tutti i dispositivi all'interno del database?\
        Verranno cancellati anche i dati delle rilevazioni")) {
            deleteRowTableDispositivi();
            socket.send("$delete-DELETE FROM ProbeRequest");
            socket.send("$delete-DELETE FROM Dispositivi");
            buttonCounter = 1;
        }
    }
}

//aggiunge un dispositivo all'interno del database 
//---------------------------------------------------------------------
function addDevice() {
    console.log(buttonCounter);
    var lat = document.getElementById("lat").value;
    var lng = document.getElementById("lng").value;
    var nome = document.getElementById("nome").value;
    var indoor = document.getElementById("inlineRadio1").checked;
    if (indoor) {
        indoor = 1;
    }
    else {
        indoor = 0;
    }
    if (socket.readyState == 1) {
        //socket.send("Aggiunta dispositivo");
        if (lat != null && lng != null) {
            if (lat != "" && lng != "") {
                if (nome.trim() == "") {
                    socket.send("$insert-INSERT INTO Dispositivi(nome, latitudine, longitudine,indoor) VALUES(?,?,?,?)-"
                        + lat + "-" + lng + "-Dispositivo " + buttonCounter + "-" + indoor);
                }
                else {
                    socket.send("$insert-INSERT INTO Dispositivi(nome, latitudine, longitudine,indoor) VALUES(?,?,?,?)-"
                        + lat + "-" + lng + "-" + nome + "-" + indoor);
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
function WiFi(id, lat, lng, time, indoor) {
    if (socket.readyState == 1) {
        now = new Date();
        var last = new Date(window.localStorage.getItem("Ultima scansione"))
        temp = now - last
        if (temp >= 600000) {
            if (parseInt((temp) / 3600000) == 0) {
                if (confirm("ultima scansione effettuata " + parseInt((temp) / 60000) + " minuti fa:\n" +
                    "i dati raccolti potrebbero essere non veritieri, continuare comunque?")) {
                    startScan(time, id, lat, lng, indoor);
                }
            } else {
                if (confirm("ultima scansione effettuata " + parseInt((temp) / 3600000) + " ore fa:\n" +
                    "i dati raccolti potrebbero essere non veritieri, continuare comunque?")) {
                    startScan(time, id, lat, lng, indoor);
                }
            }

        }
        else {
            startScan(time, id, lat, lng, indoor);
        }
    }
}

function startScan(time, id, lat, lng, indoor) {
    ProgressBar(time);
    gifMarker.clearLayers();
    realID = id.split('-')[1];
    socket.send("$scan-" + realID + "-" + time + "-" + indoor);
    var mark = L.layerGroup([createCustomMarker("", lat, lng, pulseUrl, false, pulseDim, true)]).addTo(gifMarker);
    if (indoor == 1) {
        gifMarker.addTo(indoorMap);
        phoneMarkersIndoor.clearLayers();
    }
    else {
        gifMarker.addTo(leafletMap);
        phoneMarkers.clearLayers();
    }
    var table = document.getElementById("dispositiviTrilaterati");
    while (table.rows.length != 1) {
        table.deleteRow(table.rows.length - 1)
    }
    localStorage.setItem("Ultima scansione", new Date());
}
//---------------------------------------------------------------------

function createRow(lat, lng, nome, indoor, ID) {
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
    x.id = "time-" + ID

    //creazione pulsante avvio scansione
    var bStart = document.createElement("input");
    bStart.setAttribute("type", "submit");
    bStart.setAttribute("class", "btn btn-success");
    bStart.value = "Inizia scansione";
    bStart.id = "btn-" + ID;
    bStart.style.padding = "2px";
    bStart.style.fontSize = "1.1vw";

    var bDel = document.createElement("input");
    bDel.setAttribute("type", "submit");
    bDel.setAttribute("class", "btn btn-danger");
    bDel.value = "Elimina";
    bDel.id = "btnDel-" + ID;
    bDel.style.padding = "2px";
    bDel.style.fontSize = "1.1vw";

    cell2.innerHTML = lat;
    cell3.innerHTML = lng;
    cell4.appendChild(x);
    cell5.appendChild(bStart);
    cell6.appendChild(bDel);

    bStart.onclick = function () { WiFi(bStart.id, cell2.innerHTML, cell3.innerHTML, x.value, indoor) };
    if (nome.trim() == "") {
        nome = "Dispositivo " + ID;
    }

    bDel.onclick = function () { eliminaDispositivo(bDel.id, indoor) };

    cell1.innerHTML = nome;
    if (indoor == 1) {
        var mark = createCustomMarker(nome, lat, lng, antennaUrl, false, antennaDim, false).addTo(antennaMarkersIndoor);
        row.addEventListener('mouseover', function (e) {
            mark.bindTooltip(nome)
            mark.openTooltip();
        });
        row.addEventListener('mouseout', function (e) {
            bigAntenna.clearLayers();
            mark.closeTooltip();
        });
        antennaMarkersIndoor.addTo(indoorMap);
    } else {
        var mark = createCustomMarker(nome, lat, lng, antennaUrl, false, antennaDim, false).addTo(antennaMarkers);
        row.addEventListener('mouseover', function (e) {
            mark.bindTooltip(nome)
            mark.openTooltip();
        });
        row.addEventListener('mouseout', function (e) {
            bigAntenna.clearLayers();
            mark.closeTooltip();
        });
        antennaMarkers.addTo(leafletMap);
    }


    buttonCounter++;

}

//creazione della tabella per i dispositivi che sono stati trovati sulla mappa
//dopo la trilaterazione
function createRowTableTrilateration(macAdr, lat, lng, vendor, indoor) {
    var mark;
    var table = document.getElementById("dispositiviTrilaterati");
    var row = table.insertRow(1);
    var cell1 = row.insertCell(0);
    var cell2 = row.insertCell(1);
    var cell3 = row.insertCell(2);
    var cell4 = row.insertCell(3);
    row.addEventListener('mouseover', function (e) {
        if (indoor == 1) {
            mark = createCustomMarker("", lat, lng, phoneUrl, false, [50, 60], false).addTo(bigPhoneIndoor);
            bigPhoneIndoor.addTo(indoorMap);
            mark.bindTooltip("<strong>Indirizzo Mac:</strong> " + macAdr + " <br>" + "<strong>vendor:</strong> " + vendor)
            mark.openTooltip();
        } else {
            mark = createCustomMarker("", lat, lng, phoneUrl, false, [50, 60], false).addTo(bigPhone);
            bigPhone.addTo(leafletMap);
            mark.bindTooltip("<strong>Indirizzo Mac:</strong> " + macAdr + " <br>" + "<strong>vendor:</strong> " + vendor)
            mark.openTooltip();
        }

    });
    row.addEventListener('mouseout', function (e) {
        if (indoor == 1) {
            bigPhoneIndoor.clearLayers();
            mark.closeTooltip();
        }
        else {
            bigPhone.clearLayers();
            mark.closeTooltip();
        }

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


function IndoorMap() {
    if (window.localStorage.getItem("IndoorMap") == "false") {
        $(document).ready(function () {
            $('#modalForm').modal({
                backdrop: 'static',
                keyboard: false
            })

            $("#submit").click(function () {
                // Validation
                var form = $("#inputs")
                console.log(form);

                if (form[0].checkValidity() === false) {
                    event.preventDefault()
                    event.stopPropagation()
                }
                form.addClass('was-validated')

                //Declare and initialize variable for display inputs in div
                var altezza = $('#modalForm').find("#altezza").val();
                var lunghezza = $('#modalForm').find("#lunghezza").val();
                var path = $('#modalForm').find("#nomeFile").val();
                if (altezza.trim() != "" && lunghezza.trim() != "" && path.trim() != "") {
                    CreateIndoorMap(lunghezza, altezza, path);
                    console.log(altezza, lunghezza, path)
                }

            });
        });
        deleteRowTableDispositivi();
        var table = document.getElementById("dispositiviTrilaterati");
        while (table.rows.length != 1) {
            table.deleteRow(table.rows.length - 1)
        }
        markers.clearLayers();
        socket.send("$id-SELECT max(id) FROM Dispositivi");
        document.getElementById("map1").style.visibility = "visible";
        document.getElementById("map1").style.display = "inline";
        document.getElementById("map").style.visibility = "hidden";
        document.getElementById("map").style.display = "none";
        document.getElementById("findCoordinate").disabled = true;

    } else {
        deleteRowTableDispositivi();
        var table = document.getElementById("dispositiviTrilaterati");
        while (table.rows.length != 1) {
            table.deleteRow(table.rows.length - 1)
        }
        markers.clearLayers();
        document.getElementById("map1").style.visibility = "visible";
        document.getElementById("map1").style.display = "inline";
        document.getElementById("map").style.visibility = "hidden";
        document.getElementById("map").style.display = "none";
        document.getElementById("findCoordinate").disabled = true;
        socket.send("$db-SELECT * FROM Dispositivi WHERE indoor =1");
        text = "Trascina per correggere <br> la posizione";
        markers = L.layerGroup([createCustomMarker(text, 0, 0, homeUrl, true, homeDim, false)]).addTo(indoorMap);
        socket.send("$id-SELECT max(id) FROM Dispositivi");
    }

}


function LeafletMap() {
    deleteRowTableDispositivi();
    window.localStorage.setItem("LeafletMap", "True");
    var table = document.getElementById("dispositiviTrilaterati");
    while (table.rows.length != 1) {
        table.deleteRow(table.rows.length - 1)
    }
    document.getElementById("map").style.visibility = "visible";
    document.getElementById("map").style.display = "inline";
    document.getElementById("map1").style.visibility = "hidden";
    document.getElementById("map1").style.display = "none";
    document.getElementById("findCoordinate").disabled = false;
    socket.send("$db-SELECT * FROM Dispositivi WHERE indoor =0");
    text = "Trascina per correggere <br> la posizione";
    markers.clearLayers();
    markers = L.layerGroup([createCustomMarker(text, 46.8, 11.8, homeUrl, true, homeDim, false)]).addTo(leafletMap);
    leafletMap.setView([46.8, 11.8], 10);
    socket.send("$id-SELECT max(id) FROM Dispositivi");
}


function isNumberKey(evt) {
    var charCode = (evt.which) ? evt.which : evt.keyCode;
    if (charCode != 46 && charCode > 31
        && (charCode < 48 || charCode > 57))
        return false;
    return true;
}

function eliminaDispositivo(id, indoor) {
    if (confirm("Sei sicuro di rimuovere definitivamente questo dispositivo e le sue relative ricerche?")) {
        deleteRowTableDispositivi();
        realID = id.split('-')[1];
        socket.send("$delete-DELETE FROM ProbeRequest where ProbeRequest.nodeID = " + realID);
        socket.send("$delete-DELETE FROM Dispositivi where Dispositivi.ID = " + realID);
        socket.send("$db-SELECT * FROM Dispositivi WHERE indoor =" + indoor);
    }

}

function deleteRowTableDispositivi(){
    var table = document.getElementById("tabellaDispositivi");
    antennaMarkers.clearLayers();
    antennaMarkersIndoor.clearLayers();
    //console.log(table.rows.length);
    while (table.rows.length != 1) {
        table.deleteRow(table.rows.length - 1)
    }
}




