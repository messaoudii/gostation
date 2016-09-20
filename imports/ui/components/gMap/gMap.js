/* global L */
import angular from 'angular';
import angularMeteor from 'angular-meteor';
import uiRouter from 'angular-ui-router';

import 'leaflet-routing-machine';

import 'angularjs-slider/dist/rzslider.min.js';
import 'angularjs-slider/dist/rzslider.min.css'

import './customMarkers/leaflet.awesome-markers.min.js'
import './customMarkers/leaflet.awesome-markers.css'

import { Session } from 'meteor/session';
import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker'
import { Stations } from '../../../api/stations';


import mobileTemplate from './mobile.html';
import webTemplate from './web.html';
import './gMap.css';


class GMap {
    constructor($scope, $reactive, $state, orderByFilter,$timeout) {
        'ngInject';

        $reactive(this).attach($scope);

        var vm = this;
        vm.lastPosition;
        
        
        var homeIcon = L.AwesomeMarkers.icon({
                        icon: 'fa-street-view',
                        markerColor: 'red',
                        });
        vm.currentMarker = L.marker([],{icon : homeIcon,zIndexOffset : 100});
       
        vm.markers = [];
        vm.bounds = L.latLngBounds();
        function hideMarkers(opacity){
            for(let i = 0 ; i < vm.markers.length ; i++){
                 vm.markers[i].setOpacity(opacity)
                 vm.markers[i].removeEventListener('click')
                 vm.markers[i].closePopup();
            }
        }
        function showMarkers(){
            for(let i = 0 ; i < vm.markers.length ; i++){
                 vm.markers[i].setOpacity(1)
                 vm.markers[i].on('click',markerClickHandler)
            }
        }
        
        function markerClickHandler(e){
           e.target.unbindPopup()
           let content = $('#info-window-panel');
           $(document).on("click", "#editButton",()=>{
               vm.markers[vm.station._id].closePopup()
               $scope.$apply(()=>{
                   vm.stationList.edit(e.target.station)
               })
           })
           $(document).on("click", "#goButton",()=>{
               vm.markers[vm.station._id].closePopup()
               $scope.$apply(()=>{
                  vm.direction.station = e.target.station;
                  vm.direction.show();
               })
           })
           $scope.$apply(()=>{
           vm.station = e.target.station;
                setTimeout(()=>{
                   e.target.bindPopup(content.html()).togglePopup()
                },100)
           })
          
        }
        
        vm.station = {};
        var button = $('<div>').html('<button class="btn btn-primary">Ajouter</button>');
        var newStationPopUp = L.popup().setContent(button[0]);
        function mapClickHandler(e){
            map.setView(e.latlng,16);
            newStationPopUp.setLatLng(e.latlng)
            newStationPopUp.openOn(map)
            vm.addStation.e = e;
            //alert(e.latlng)
        }
        
        
        
        //initiailer la map avec la position actuel
        L.Icon.Default.imagePath = 'packages/bevanhunt_leaflet/images';
        var map = L.map('mapid',{zoomControl: false});
        //map.spin(true);
        var routing = {};
        
        vm.helpers({
            current() {
                let pos = Location.getReactivePosition() || Location.getLastPosition() || { latitude: 0, longitude: 0 };
                vm.currentMarker.setLatLng([pos.latitude, pos.longitude]);
                vm.currentMarker.update();
                if(vm.direction&&vm.direction._show){
                    routing.spliceWaypoints(0, 1, L.latLng(pos.latitude,pos.longitude))
                    map.panTo(L.latLng(pos.latitude,pos.longitude))
                }
                return pos;
            }
        });
        
        vm.lastPosition = vm.current;
        
        map.once('load', () => {
            L.control.zoom({
                position:'topright'
            }).addTo(map);
            vm.currentMarker.addTo(map)
            
            routing  =  L.Routing.control({
                waypoints: [],
                show : false,
                draggableWaypoints : false,
                addWaypoints : false,
                fitSelectedRoutes : false,
                showAlternatives : true,
                lineOptions : {styles : [{color: 'black', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.8, weight: 6}, {color: 'blue', opacity: 1, weight: 3}]},
                altLineOptions :{styles : [{color: 'black', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.8, weight: 6}, {color: 'red', opacity: 0.9, weight: 2}]}
            });
            routing.addTo(map); 
            routing.hide();
            routing.on('routesfound',(e)=>{
                $scope.$apply(()=>{

                    vm.direction.summary.totalDistance = e.routes[0].summary.totalDistance/1000 > 1?(e.routes[0].summary.totalDistance/1000).toFixed(2)+" Km":(e.routes[0].summary.totalDistance).toFixed(1)+" Métres";
                    let duration = new Date(e.routes[0].summary.totalTime*1000);
                    let hh = duration.getUTCHours();
                    let mm = duration.getUTCMinutes();
                    let ss = duration.getSeconds();
                    vm.direction.summary.totalTime = (hh > 0 ? hh + " heurs et " : "") + (mm > 0 ? mm + " minutes" : "") + ((hh == 0 && mm == 0) ? ss + " secondes." : ".");                                
                })
            })               
        }).setView([vm.current.latitude, vm.current.longitude], 13);
        L.tileLayer('https://api.mapbox.com/styles/v1/mapbox/streets-v9/tiles/256/{z}/{x}/{y}?access_token=pk.eyJ1IjoibWVzc2FvdWRpb3Vzc2FtYSIsImEiOiJjaXQ2MjBqdHQwMDFsMnhxYW9hOW9tcHZoIn0.uX-ZR_To6tzxUpXmaVKOnQ', {
        }).addTo(map);

        vm.connectionToast = {
            _show: false,
            setShow: function (val) {
                this._show = val;
            },
        }


        Tracker.autorun(() => {
            vm.connectionToast.setShow(!Meteor.status().connected)
        })

        vm.helpers({
            user() {
                return Meteor.user()
            }
        })

        vm.stationHandler;
        vm.firstStation;
        vm.helpers({
            stations() {
                let query = Stations.find({});
                vm.stationHandler = query.observeChanges({
                        added: function (id, station) {
                            station._id = id;
                            vm.markers[id] =  L.marker([station.cord.lat,station.cord.lng],{zIndexOffset : 90});
                            vm.markers[id].addTo(map);
                            vm.markers[id].station = station;
                            vm.markers[id].on('click',markerClickHandler)
                        },
                        changed(id,station){
                        },
                        removed: function (id) {
                            map.removeLayer(vm.markers[id]);
                            vm.markers[id] = {};
                        }
                    })
                return query;
            }
        });
       
       

        //partie radius Panel,
        vm.radiusPanel = {
            dep: new Tracker.Dependency,
            _show: false,
            radius: Meteor.user().profile.radius,
            options: {
                    floor: 400,
                    ceil: 30000,
                    showSelectionBar: true,
                    getSelectionBarColor: function(value) {
                        
                    vm.radiusPanel.circle.setRadius(value);
                    map.fitBounds(vm.radiusPanel.circle.getBounds())
                    
                    if (value <= 5000){
                        vm.radiusPanel.circle.setStyle({color : 'red'})
                        return 'red';
                    }
                    if (value <= 15000){
                        vm.radiusPanel.circle.setStyle({color : 'orange'})
                        return 'orange';
                    }
                    if (value <= 25000){
                        vm.radiusPanel.circle.setStyle({color : 'blue'})
                        return 'blue';
                    }
                    vm.radiusPanel.circle.setStyle({color : 'green'})
                    return 'green';
                    },
                    translate: function (value) {
                        if(value/1000>1)
                            return (value/1000).toFixed(2)+"Km"
                        
                        return value+"Métres";
                    }
                    },
            circle: {},
            setRadius: function (newVal) {
                this.radius = newVal;
                this.dep.changed();
            },
            getRadius: function () {
                this.dep.depend();
                return this.radius;
            },
            show: function (station) {
                this.circle = L.circle([vm.current.latitude, vm.current.longitude], this.radius);
                this.circle.addTo(map);
                map.fitBounds(this.circle.getBounds())
                this._show = true;
                vm.stationListTrigger.hide();
                $timeout(function () {
                    $scope.$broadcast('rzSliderForceRender');
                });
            },
            hide: function () {
               map.removeLayer(this.circle);
               this.circle = {};
               this._show = false;
               vm.stationListTrigger.show();
            },
            submitRadius: function () {
                this.dep.changed();
                this.hide();
                map.fitBounds(vm.bounds)
                Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.radius': this.radius } });
            }
        }

            
            
        //Partie sideBar 
        vm.sideBarTrigger = {
            _show: true,

            click: function () {
                vm.sideBarPanel.toggle();
            },
            show: function () {
                this._show = true;
            },
            hide: function () {
                this._show = false;
            }
        }

        vm.sideBarPanel = {
            dep: new Tracker.Dependency,
            _show: false,
            _showOwnerStations: false,
            getShowOwnerStations: function () {
                this.dep.depend();
                return this._showOwnerStations;
            },
            showOwnerStations: function () {
                this._showOwnerStations = true;
                this.dep.changed();
                this.hide();
                setTimeout(()=>{
                     map.fitBounds(vm.bounds)
                },300)
            },
            hideOwnerStations: function () {
                this._showOwnerStations = false;
                this.dep.changed();
                setTimeout(()=>{
                     map.fitBounds(vm.bounds)
                },300)
            },
            toggle: function () {
                this._show = !this._show;

                if (this._show) {
                    vm.mapShadow.show();
                } else {
                    vm.mapShadow.hide();
                }
            },
            show: function () {
                this._show = true;
            },
            hide: function () {
                this._show = false;
                vm.mapShadow.hide();
            },

            addStationTrigger: function () {
                this.hide();
                vm.addStation.show();
            },
            logOutTrigger: function () {
                Meteor.logout(function (error) {
                    if (error)
                        alert(error)
                })
            },
            settingsTrigger: function () {
                this.hide();
                vm.settingsPanel.show()
                vm.mapShadow.show();
            }
        }
        
       
        //partie settings
        
        vm.settingsPanel = {
            dep: new Tracker.Dependency,
            _show: false,
            orderBy: Meteor.user().profile.orderBy,
            showCloseStation :  Meteor.user().profile.showCloseStation,
            showNoEssence : Meteor.user().profile.showNoEssence,
            showNoGasoil : Meteor.user().profile.showNoGasoil,
            
            setOrderBy: function (orderBy) {
                if (this.orderBy.value !== orderBy.value) {
                    this.orderBy = orderBy;
                    this.dep.changed();
                    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.orderBy': orderBy } });
                }
            },
            getOrderBy: function () {
                this.dep.depend();
                return this.orderBy
            },
            
            setShowCloseStation: function (newVal) {
                if (this.showCloseStation !== newVal) {
                    this.showCloseStation = newVal;
                    this.dep.changed();
                    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.showCloseStation': newVal } });
                }
            },
            getShowCloseStation: function () {
                this.dep.depend();
                return this.showCloseStation;
            },
            
            setShowNoEssence: function (newVal) {
                if (this.showNoEssence !== newVal) {
                    this.showNoEssence = newVal;
                    this.dep.changed();
                    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.showNoEssence': newVal } });
                }
            },
            getShowNoEssence: function () {
                this.dep.depend();
                return this.showNoEssence;
            },
            
            setShowNoGasoil: function (newVal) {
                if (this.showNoGasoil !== newVal) {
                    this.showNoGasoil = newVal;
                    this.dep.changed();
                    Meteor.users.update({ _id: Meteor.user()._id }, { $set: { 'profile.showNoGasoil': newVal } });
                }
            },
            getShowNoGasoil: function () {
                this.dep.depend();
                return this.showNoGasoil;
            },
            
            toggle: function () {
                this._show = !this._show;

                if (this._show) {
                    vm.mapShadow.show();
                } else {
                    vm.mapShadow.hide();
                }
            },
            show: function () {
                this._show = true;
            },
            hide: function () {
                this._show = false;
                vm.mapShadow.hide();
            },
            radiusTrigger: function () {
                vm.radiusPanel.show();
                this.hide();
            }

        }
        
        
        
         vm.helpers({
            fistStationIcon() {
                return L.AwesomeMarkers.icon({
                        icon: vm.settingsPanel.getOrderBy().value=='distance.value'?'fa-clock-o':'fa-money',
                        markerColor: 'orange',
                        spin : true
                        });
            }
        })
        
        
        Tracker.autorun(() => {
            var origin = vm.getReactively('current');
            var distance = 0;
            if(origin&&vm.lastPosition){
                 distance = L.latLng(origin.latitude,origin.longitude).distanceTo(L.latLng(vm.lastPosition.latitude,vm.lastPosition.longitude));
            }
            if(distance > 100){
                updateDistances(vm.stations, getOrigins(vm.stations, 20), origin, function () {
                        $scope.$apply(() => {
                            vm.sortedStations = orderByFilter(vm.stations,[vm.settingsPanel.getOrderBy().value,'distance.value']);
                            
                            if(vm.firstStation&&vm.markers[vm.firstStation._id]&&vm.firstStation!=vm.firstStation._id){
                              vm.markers[vm.firstStation._id].setIcon(new L.Icon.Default());
                              vm.markers[vm.sortedStations[0]._id].setIcon(vm.fistStationIcon);
                              vm.firstStation = vm.sortedStations[0];
                            }
                        })
                     });
            }
            vm.lastPosition = origin;
        })       

        Tracker.autorun(() => {
            //let pos = Location.getReactivePosition();
            //if (!pos)

            let pos = vm.current;//Location.getLastPosition()
            let bounds = { center: [pos.longitude, pos.latitude], radius: 0.000621371 * vm.radiusPanel.getRadius() };

            if(vm.sideBarPanel.getShowOwnerStations()){
                Meteor.subscribe('stations', { "owner": Meteor.user()._id });
            }else{
               let selector = [{ cord: { $geoWithin: { $centerSphere: [bounds.center, bounds.radius / 3963.2] } } }];
               
               if(!vm.settingsPanel.getShowCloseStation())
                    selector.push({"open" :{$eq : true}});
               if(!vm.settingsPanel.getShowNoEssence())
                    selector.push({$or : [{"essence.dispo" :{$eq : true}},{"gasoil.dispo" :{$eq : true}}]});
               if(!vm.settingsPanel.getShowNoGasoil())
                    selector.push({$or : [{"gasoil.dispo" :{$eq : true}},{"essence.dispo" :{$eq : true}}]});
                    
               Meteor.subscribe('stations',{$and : selector});               

            }
        })

       
 
      
        //utile functions
        
        function getOrigins(stations, max) {
            vm.bounds = L.latLngBounds([]);
            vm.bounds.extend(L.latLng(vm.current.latitude,vm.current.longitude))
            vm.stationList.globaleLikes = 1;
            let tmp = [];
            var q = Math.floor(stations.length / max);
            var r = stations.length % max

            for (let j = 0; j <= (r == 0 ? q - 1 : q); j++) {
                tmp[j] = '';
                for (let i = j * max; i < (j == q ? r + j * max : (j + 1) * max); i++) {
                    tmp[j] += stations[i].cord.lat + ',' + stations[i].cord.lng + "|";
                    vm.bounds.extend(L.latLng(stations[i].cord.lat,stations[i].cord.lng))
                    stations[i].like = Meteor.user().profile.likes[stations[i]._id]?Meteor.user().profile.likes[stations[i]._id]:0;
                    vm.stationList.globaleLikes+= stations[i].likes
                }

                tmp[j] = tmp[j].slice(0, -1)
            }
            return { dest: tmp, max: max };
        }


        function updateDistances(stations, destinations, origin, callback) {
            angular.forEach(destinations.dest, function (destination, j) {
                if (destination && destination.trim().length > 1 && Meteor.status().connected) {
                    Meteor.call('getDistance', [origin.latitude, origin.longitude], destination, function (error, response) {
                        if (error || response.statusCode !== 200 || data.status !== "OK") {
                            alert('verifier votre reseaux !: ');
                            
                             angular.forEach(stations, function (station, index) {
                                var estimated = L.latLng(origin.latitude,origin.longitude).distanceTo(L.latLng(station.cord.lat, station.cord.lng));
                                station.distance.text = estimated > 1000 ? (estimated / 1000).toFixed(2) + " km" : Math.round(estimated) + " m";
                                station.distance.value = estimated;

                                var travelTime = estimated / 0.017;
                                var duration = new Date(travelTime);
                                var hh = duration.getUTCHours();
                                var mm = duration.getUTCMinutes();
                                var ss = duration.getSeconds();

                                station.duration.text = (hh > 0 ? hh + " heurs et " : "") + (mm > 0 ? mm + " minutes" : "") + ((hh == 0 && mm == 0) ? ss + " secondes." : ".");
                                station.duration.value = travelTime / 1000;
                                
                                 vm.markers[station._id].station = station;
                            });
                            callback()
                            
                        }
                        else{
                            var data = JSON.parse(response.content);
                            angular.forEach(data.rows[0].elements, function (element, index) {
                                if (element && element.status === "OK") {
                                    if (element.distance) {
                                        stations[j * destinations.max + index].distance.text = element.distance.text;
                                        stations[j * destinations.max + index].distance.value = element.distance.value;
                                    }
                                    if (element && element.duration) {
                                        stations[j * destinations.max + index].duration.text = element.duration.text;
                                        stations[j * destinations.max + index].duration.value = element.duration.value;
                                    }
                                } else {
                                    var estimated = L.latLng(origin.latitude,origin.longitude).distanceTo(L.latLng(stations[j * destinations.max + index].cord.lat, stations[j * destinations.max + index].cord.lng));
                                    stations[j * destinations.max + index].distance.text = estimated > 1000 ? (estimated / 1000).toFixed(2) + " km" : Math.round(estimated) + " m";
                                    stations[j * destinations.max + index].distance.value = estimated;

                                    
                                    var travelTime = estimated / 0.017;
                                    var duration = new Date(travelTime);
                                    var hh = duration.getUTCHours();
                                    var mm = duration.getUTCMinutes();
                                    var ss = duration.getSeconds();

                                    stations[j * destinations.max + index].duration.text = (hh > 0 ? hh + " heurs et " : "") + (mm > 0 ? mm + " minutes" : "") + ((hh == 0 && mm == 0) ? ss + " secondes." : ".");
                                    stations[j * destinations.max + index].duration.value = travelTime / 1000;
                                }
                                vm.markers[stations[j * destinations.max + index]._id].station = stations[j * destinations.max + index];
                            });

                            if (j == destinations.dest.length - 1) {
                                callback()
                            }
                        }
                    });
                }else{
                    angular.forEach(stations, function (station, index) {
                                var estimated = L.latLng(origin.latitude,origin.longitude).distanceTo(L.latLng(station.cord.lat, station.cord.lng));
                                station.distance.text = estimated > 1000 ? (estimated / 1000).toFixed(2) + " km" : Math.round(estimated) + " m";
                                station.distance.value = estimated;

                                var travelTime = estimated / 0.017;
                                var duration = new Date(travelTime);
                                var hh = duration.getUTCHours();
                                var mm = duration.getUTCMinutes();
                                var ss = duration.getSeconds();

                                station.duration.text = (hh > 0 ? hh + " heurs et " : "") + (mm > 0 ? mm + " minutes" : "") + ((hh == 0 && mm == 0) ? ss + " secondes." : ".");
                                station.duration.value = travelTime / 1000;
                                
                                vm.markers[station._id].station = station;
                            });
                            callback()
                  }
            });
        }

        
       
          
       
        //station object
        function Station() {
            this.nom = '',
            this.number = '',
            this.address = '',
            this.cord = { lat: '', lng: '' },
            this.distance = { text: '', value: '', estimated: 0 },
            this.duration = { text: '', value: '' },
            this.gasoil = { dispo: false, prix: 0 },
            this.essence = { dispo: false, prix: 0 },
            this.open = true,
            this.reclamation = [],
            this.likes = 0,
            this.like = 0;
            this.owner = Meteor.user()._id;
        }
        
        
        
        //partie Map shadow 
        vm.mapShadow = {
            _show: false,

            click: function () {
                if(vm.sideBarPanel._show){
                    vm.sideBarPanel.hide()   
                    this.hide();
                }
            },

            hide: function () {
                this._show = false;
            },
            show: function () {
                this._show = true;
            }
        }
        
        
        //current position trigger
        vm.currentPositionTrigger = {
            _show: true,

            click: function () {
               map.panTo(L.latLng(vm.current.latitude,vm.current.longitude))
            },
            show: function () {
                this._show = true;
            },
            hide: function () {
                this._show = false;
            }
        }
       
        //partie add Station
        vm.addStation = {
            _show: false,
            mode: '', //'picker' pour choisir les coordonnées dans la carte , 'info' pour saisir les info    
            
            station: new Station(),

            e: {}, //click map event object
            
            show: function () {
                this._show = true;
                this.mode = 'picker';
                vm.stationListTrigger.hide();
                
                hideMarkers(0.4);
                map.on('click',mapClickHandler);
            },
            hide: function () {
                this._show = false;
                this.mode = '';
                vm.stationListTrigger.show();
                vm.mapShadow.hide();

                this.station = new Station();

                showMarkers()
                map.removeEventListener('click')
                map.closePopup()
            },

            submit: function () {
                Stations.insert(this.station);
                this.hide();
                map.fitBounds(vm.bounds)
                
            },

            hiddenButtonClick: function () {
                map.removeEventListener('click')
                map.closePopup()
                
                Meteor.call('geocod', [vm.addStation.e.latlng.lat, vm.addStation.e.latlng.lng], function (error, response) {
                    if (error) {
                        return;
                    }
                    var data = JSON.parse(response.content);
                    if (data.results[0].formatted_address) {
                        vm.addStation.station.address = data.results[0].formatted_address;
                    }
                })
                
                vm.addStation.station.cord = { lng: vm.addStation.e.latlng.lng, lat: vm.addStation.e.latlng.lat};
                $scope.$apply(()=>{
                    vm.mapShadow.show();
                    vm.addStation.mode = 'info';
                })
            }
        }
        
         button.on('click',vm.addStation.hiddenButtonClick)
        
        //partie stations List
        vm.stationListTrigger = {
            _show: true,

            loading: false,
            click: function () {
                vm.stationList.toggle();
            },
            show: function () {
                this._show = true;
            },
            hide: function () {
                this._show = false;
            }
        }

        vm.stationList = {
            _show: false,
            search : {nom : ''},
            globaleLikes : 1,
            blockRating : false,
            oldLike : 0,
            setLike : function(station,n){
                if(!this.blockRating){
                    var tmp = n-station.like;
                    Meteor.call('updateUserLikes',station._id,n,function(err,data){
                    })
                    Stations.update(station._id,{$inc : {likes : tmp}},function(error,n){
                    })
                }                
            },
            toggle: function () {
                this._show = !this._show;

                if (this._show) {
                    updateDistances(vm.stations, getOrigins(vm.stations, 20), vm.lastPosition, function () {
                        $scope.$apply(() => {
                            vm.sortedStations = orderByFilter(vm.stations,[vm.settingsPanel.getOrderBy().value,'distance.value']);
                            vm.stationListTrigger.loading = false;
                        })
                     });
                    vm.mapShadow.show();
                } else {
                    vm.mapShadow.hide();
                }
            },
            show: function () {
                this._show = true;
            },
            hide: function () {
                this._show = false;
                this.search = {nom : ''};
                vm.mapShadow.hide();
            },
            edit: function (station) {
                if(vm.markers[vm.station._id])
                  vm.markers[vm.station._id].closePopup()
                  
                this.hide();
                vm.editStation.show(station)
            },
            go: function (station) {
                vm.direction.station = station;
                vm.direction.show();
               
                if(vm.markers[vm.station._id])
                  vm.markers[vm.station._id].closePopup()
                
                this.hide();
            },
            reclamer: function(station){
                this.hide();
                vm.reclamerPanel.show(station);
            },
            showReclamations:function(station){
                this.hide();
                vm.reclamationsPanel.show(station);
            }
        }
        //Partie Réclamation
        
        vm.reclamerPanel = {
            _show : false,
            station : {},
            message : "",
            show : function(station){
                this._show = true;
                this.station = station,
                vm.mapShadow.show();
            },
            hide : function(){
                this._show = false;
                vm.mapShadow.hide();
                this.station = {};
                this.message = "";
            },
            submit : function(){
                Stations.update(this.station._id, {
                    $push : {
                        reclamation : {
                            sender : 
                                {
                                    nom : Meteor.user().profile.lastName,
                                    prenom : Meteor.user().profile.firstName,
                                    email : Meteor.user().emails[0].address,
                                },
                            date : new Date(),
                            message: this.message,
                            vue : false
                        }
                    }
                })
                this.hide();
            }
        }

        
        vm.reclamationsPanel = {
            _show : false,
            station : {},
            show:function(station){
                this._show = true;
                this.station = station,
                vm.mapShadow.show();
            },
            hide: function () {
                this._show = false;
                
                Stations.update(this.station._id,{$set : {reclamation : []}});
                
                /*for(let i = 0 ; i < this.station.reclamation.length ; i++){
                     Meteor.call('updateRec',this.station._id,function(err,data){})
                }*/
                this.station = {};
                vm.mapShadow.hide();
            },
        }
        
        //Partie direction
        
        
        vm.direction = {
            _show: false,
            _showPanle: false,
            station : {},
            summary : {totalDistance : "0 Métre",totalTime : "0 s"},
            togglePanel: function () {
                this._showPanel = !this._showPanel;
            },
            show: function () {
                routing.setWaypoints([
                    L.latLng(vm.current.latitude,vm.current.longitude),
                    L.latLng(this.station.cord.lat,this.station.cord.lng)
                ])
                hideMarkers(0.3);
                map.setView(L.latLng(vm.current.latitude,vm.current.longitude),16)
                this._show = true;
            },
            hide: function () {
                this._show = false;
                this.summary = {totalDistance : "0 Métre",totalTime : "0 s"};
                this.hidePanel();
                showMarkers();
                map.fitBounds(vm.bounds);
                routing.setWaypoints([]);
            },
            showPanle: function () {
                this._showPanel = true;
            },
            hidePanel: function () {
                this._showPanel = false;
            },
        }
        

        //partie edit station
        vm.editStation = {
            _show: false,
            station: {},
            toggle: function () {
                this._show = !this._show;

                if (this._show) {
                    vm.mapShadow.show();
                } else {
                    vm.mapShadow.hide();
                }
            },
            show: function (station) {
                this.station = station;
                vm.mapShadow.show();
                this._show = true;
            },
            hide: function () {
                this._show = false;
                this.station = new Station();
                vm.mapShadow.hide();
            },
            submit: function () {
                this.station.gasoil.prix = Number(this.station.gasoil.prix);
                this.station.essence.prix = Number(this.station.essence.prix);
                Stations.update(this.station._id, {
                    $set: { gasoil: this.station.gasoil,
                            essence: this.station.essence,
                            open : this.station.open },
                })
                this.hide();
            }
        }



        vm.helpers({
            sortedStations() {
                let stations = vm.getReactively('stations');
                let orderBy = vm.settingsPanel.getOrderBy().value;
                
                vm.stationListTrigger.loading = true;
                vm.stationList.blockRating = true;
                updateDistances(stations, getOrigins(stations, 20), vm.lastPosition, function () {
                    $scope.$apply(() => {
                        vm.sortedStations = orderByFilter(stations, [orderBy,'distance.value']);
                        
                        if(vm.firstStation&&vm.markers[vm.firstStation._id])
                             vm.markers[vm.firstStation._id].setIcon(new L.Icon.Default());
                             
                             vm.markers[vm.sortedStations[0]._id].setIcon(vm.fistStationIcon);
                             vm.firstStation = vm.sortedStations[0];
                        
                        vm.stationListTrigger.loading = false;
                        vm.stationList.blockRating = false;

                    })
                });
                return vm.sortedStations;//orderByFilter(stations, [vm.settingsPanel.getOrderBy().value,'distance.value']);
            }
        });


    }
}

const name = 'gMap';
const template = Meteor.isCordova ? mobileTemplate : webTemplate;

// create a module
export default angular.module(name, [
    angularMeteor,
    uiRouter,
    'rzModule'//Slider Module
]).component(name, {
    template,
    controllerAs: name,
    controller: GMap,
}).config(config);
function config($stateProvider, $locationProvider, $urlRouterProvider) {
    'ngInject';

    $stateProvider
        .state('app', {
            url: '/app',
            template: '<g-map></g-map>',
            resolve: {
                currentUser($q) {
                    if (Meteor.user() === null) {
                        return $q.reject();
                    } else {
                        return $q.resolve();
                    }
                }
            }
        })
}