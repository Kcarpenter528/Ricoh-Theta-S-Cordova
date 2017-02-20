function Theta(){
	this.thetaIP = 'http://192.168.1.1:80';
	this.thetaOSCPath = this.thetaIP +'/osc/commands/execute';
	this.session_id = null;//"SID_0001";//null;
	this.session_expires = null;
	this.fingerprint = null;
	this.thetaNetworkSSID = null;
	this.wifiwizard_connector = null;
	this.connectedToTheta = false;
	this.defaultHeaders = {
		'Content-Type' : 'application/json; charset=utf-8',
		'X-XSRF-Protected': '1'
	};
	this.thetaStatus = null;
}

Theta.prototype.connectToTheta = function(){
	var me = this;
	if(me.connectedToTheta){
		console.log('Already Connected To Theta');
		me.connectedToTheta = true;
		me.startCameraSession();
	} else {
		Ext.Viewport.setMasked({
			xtype : 'loadmask',
			message : 'Scanning Wifi...'
		});
		WifiWizard.isWifiEnabled(function(isEnabled){
			if(isEnabled){
				console.log('Wifi Is Enabled');
				//See What WIFI I am connected to if I am
				WifiWizard.getCurrentSSID(function(SSID){
					console.log('Got Current SSID: ' + SSID);
					if(SSID.includes("THETA")){
						console.log('Is A Theta SSID');
						//Probably already connected to Theta Wifi
						me.thetaNetworkSSID = SSID;
						thetaNetworkFound = true;
						me.connectedToTheta = true;
						
						Ext.defer(function(){
							me.startCameraSession();
							Ext.Viewport.setMasked(false);
						}, 3000);
					} else {
						console.log('Not A Theta SSID - Start Scan');
						me.scanForWiFiAPs();
					}
				}, function(){
					console.log('Could Not Read Current SSID - Likely just not connected to anything');
					me.scanForWiFiAPs();
				});
			} else {
				console.log('Wifi Was Off, Turning On');
				me.enableDeviceWifi();
			}
		}, function(){
			console.log('Could Not Determin Wifi State');
			me.error('Could Not Read Wifi State', false);
		});
	}
};
	
Theta.prototype.scanForWiFiAPs = function(){
	var me = this;
	//Scan Networks for Theta Wifi
	WifiWizard.startScan(function(){
		//Scan Started give it a few seconds to populate
		console.log('Wifi AP Scan Started');
		Ext.defer(function(){
			//We waited on the scan for a few seconds, now get the results.
			WifiWizard.getScanResults({numLevels: 5}, function(networks){
				console.log('Got WIFI Scan Results');
				console.log(networks);
				var thetaNetworkFound = false;
				for(var i = 0; i<networks.length; i++){
					var network = networks[i];
					if(network.SSID.includes("THETA")){
						console.log('Found A Theta SSID');
						me.thetaNetworkSSID = network.SSID;
						thetaNetworkFound = true;
					}
				}			
				if(thetaNetworkFound){
					console.log('Attempt To Connect To Theta');
					me.connectToThetaWifi();			
				} else {
					console.log('No Theta Wifis Found');
					me.error('Could Not Find THETA Wifi. Make Sure Theta Wifi Is On And In Range', false);
				}
			}, function(){
				console.log('Could Not Get WIFI Scan Results');
				me.error('Failed To Get Wifi AP Scan Results', false);
			});
		}, 10000);
	}, function(){
		console.log('Could Not Start WIFI Scan');
		me.error('Could Not Initiate Wifi AP Scanning', false);
	});
};
	
Theta.prototype.connectToThetaWifi = function(){
	var me = this;
	//Do a little work to dig out the Wifi password from the AP Name.
	//This only works if the Wifi name is the default and starts with THETAXS and ends with .OSC
	var period_idx = me.thetaNetworkSSID.indexOf('.');
	var password =  me.thetaNetworkSSID.substring(7, period_idx);
	me.wifiwizard_connector = WifiWizard.formatWifiConfig(me.thetaNetworkSSID, password, 'WPA');
	WifiWizard.addNetwork(me.wifiwizard_connector, function(){
		Ext.defer(function(){
			me.initCameraConnection();
		}, 1000);
	}, function(){
		me.connectedToTheta = false;
		console.log('Could Not Add Theta WIFI To Device');
		me.error('Could Not Add Theta Wifi To Device', false);
	});	
};
	
Theta.prototype.initCameraConnection = function(){
	var me = this;
	WifiWizard.connectNetwork(me.thetaNetworkSSID, function(){
		console.log('Connected To Theta Wifi');
		me.connectedToTheta = true;
		Ext.defer(function(){
			me.startCameraSession();
			Ext.Viewport.setMasked(false);
		}, 3000);
	}, function(){
		console.log('Could Not Connect To Theta Wifi');
		me.error('Could Not Add Theta Wifi To Device', false);
	});	
};
	
Theta.prototype.disconnectFromTheta = function(){
	var me = this;
	WifiWizard.disconnectNetwork(me.thetaNetworkSSID, function(){
		console.log('Disconnected From Theta');
	}, function(){
		me.error('Could Not Disconnect From Theta Wifi AP.', false);
	});
};
	
Theta.prototype.enableDeviceWifi = function(){
	var me = this;
	WifiWizard.setWifiEnabled(true, function(){
		console.log('Device WIFI Enabled');
		//Call Back ConnectToTheta if it is enabled
		me.connectToTheta();
	}, function(){
		me.error('Could Not Turn On Device Wifi.<br>Please Manualy Turn On Device Wifi And Try Again.', false);
	});
};

Theta.prototype.startCameraSession = function(){
	console.log('Attempt To Start Theta Session');
	var me = this;
	
	var params = {
		"name": "camera.startSession",
		"parameters": {}
	};
	cordova.plugin.http.setDataSerializer("json");
	cordova.plugin.http.post(me.thetaOSCPath, params, me.defaultHeaders, function(response) {
		Ext.Msg.alert('Success', 'Theta S Connected');
		console.log('Theta Session Started');
		response.data = JSON.parse(response.data);
		console.log(response);
		me.session_id = response.data.results.sessionId;
		me.setSessionExpires(response.data.results.timeout);
		me.setThetaAPILevel();
	}, function(response) {
		console.log('Failed To Start Theta Session');
		me.error('Failed To Start Theta Session', response);
	});
};

Theta.prototype.setSessionExpires = function(timeout){
	var me = this;
	var time = new Date().getTime() / 1000;
	me.session_expires = time + timeout;
};

Theta.prototype.setThetaAPILevel = function(){
	console.log('Attempting To Set API Level');
	var me = this;
	var params = {
		 "name": "camera.setOptions",
		"parameters": {
			"sessionId": me.session_id,
			"options": {
				"clientVersion": 2
			}
		}
	};
	cordova.plugin.http.setDataSerializer("json");
	cordova.plugin.http.post(me.thetaOSCPath, params, me.defaultHeaders, function(response) {
		console.log('Theta API Version Set TO 2');
		response.data = JSON.parse(response.data);
		console.log(response);
		me.getThetaFileList();
		me.checkThetaStatus();
		Ext.Viewport.setMasked(false);
	}, function(response) {
		console.log('Failed To Set Theta API Version');
		me.error('Failed To Set Theta API Version', response);
	});
};

Theta.prototype.checkThetaStatus = function(){
	console.log('Checking Theta Status');
	var me = this;
	var params = {};
	cordova.plugin.http.setDataSerializer("json");
	cordova.plugin.http.post(me.thetaIP + '/osc/state', params, {}, function(response) {
		console.log('Got Theta Status');
		response.data = JSON.parse(response.data);
		me.fingerprint = response.data.fingerprint;
		console.log(response);
	}, function(response) {
		console.log('Failed To Get Theta Status');
		me.error('Failed To Get Theta Status', response);
	});
};

Theta.prototype.takePhoto = function(store){
	Ext.Viewport.setMasked({
		xtype : 'loadmask',
		message : 'Taking Photo...'
	});
	var me = this;
	var fingerprint = me.fingerprint;
	var params = {
		"name": "camera.takePicture",
		"parameters": {}
	};
	 cordova.plugin.http.setDataSerializer("json");
	 cordova.plugin.http.post(me.thetaOSCPath, params, me.defaultHeaders, function(response) {
		console.log('Photo Capture Triggered');
		response.data = JSON.parse(response.data);
		console.log(response);
		
		Ext.defer(function(){
			Ext.Viewport.setMasked(false);
			me.getThetaFileList(store, 0);
		}, 8000);
	}, function(response) {
		Ext.Viewport.setMasked(false);
		console.log('Failed To Trigger Photo Capture');
		me.error('Failed To Trigger Theta Photo Capture', response);
	});
};

Theta.prototype.checkPhotoStatus = function(){
	var me = this;
	
	var params = {
		"stateFingerprint": me.fingerprint
	};
	 cordova.plugin.http.setDataSerializer("json");
	 cordova.plugin.http.post(me.thetaIP+'/osc/checkForUpdates', params, me.defaultHeaders, function(response) {
		console.log('Checked For Photo Status');
		response.data = JSON.parse(response.data);
		console.log(response);
		me.fingerprint = response.data.stateFingerprint;
	}, function(response) {
		console.log('Failed To Check Photo Status');
		me.error('Failed To Trigger Theta Photo Capture', response);
	});
};

Theta.prototype.getThetaFileList = function(store, idx){
	var me = this;
	Ext.Viewport.setMasked({
		xtype : 'loadmask',
		message : 'Fetching Thumbnails...'
	});
	
	if(idx === 0){
		store.removeAll();
	}
	
	var params = {
		"name": "camera.listFiles",
		"parameters" : {
			"fileType": "all",
			"startPosition": idx,
			"entryCount": 1,
			"maxThumbSize": 640
		}
	};
	 cordova.plugin.http.setDataSerializer("json");
	 cordova.plugin.http.post(me.thetaOSCPath, params, me.defaultHeaders, function(response) {
		console.log('Got Theta File List');
		response.data = JSON.parse(response.data);
		var fileCount = response.data.results.totalEntries;
		store.add([{
			thu_uri: 'data:image/jpg;base64,'+response.data.results.entries[0].thumbnail,
			file_url: response.data.results.entries[0].fileUrl,
			downloaded: 0
		}]);
		
		idx++;
		if(idx < fileCount){
			me.getThetaFileList(store, idx);
		} else {
			Ext.Viewport.setMasked(false);
		}
	}, function(response) {
		console.log('Failed To List Theta Files');
		me.error('Failed To Acquire Theta File List', response);
	});
};

Theta.prototype.getMostRecentFile = function(){
	console.log('Attempt to get file list');
	var me = this;
	
	var params = {
		"name": "camera.listFiles",
		"parameters" : {
			"fileType": "all",
			"entryCount": 1,
			"maxThumbSize": 640
		}
	};
	 cordova.plugin.http.setDataSerializer("json");
	 cordova.plugin.http.post(me.thetaOSCPath, params, me.defaultHeaders, function(response) {
		console.log('Got Theta File List');
		response.data = JSON.parse(response.data);
		console.log(response);
	}, function(response) {
		console.log('Failed To List Theta Files');
		me.error('Failed To Acquire Theta File List', response);
	});
};

Theta.prototype.checkPhotoStatus = function(){
	
};

	
Theta.prototype.downloadCameraPhotoToDevice = function(file_url){
	var me = this;
	Ext.Viewport.setMasked({
		xtype : 'loadmask',
		message : 'Downloading Image...'
	});
	var fileTransfer = new FileTransfer();
	var photo_uri = encodeURI(file_url);
	
	window.resolveLocalFileSystemURL(cordova.file.externalRootDirectory, function(fs) {
		fs.getDirectory('/Pictures/', {
			create: true,
			exclusive: false
		}, function(photo_directory) {
			var d = new Date();
			var uniqueNewFilename = Date.parse(d) + ".jpg";
			var local_uri = photo_directory.nativeURL + uniqueNewFilename;
			fileTransfer.download(photo_uri, local_uri, function(entry){
				console.log('download success');
				console.log(entry);
				me.generateImageThumbnail(entry.nativeURL);
				//Ext.Viewport.setMasked(false);
				//Success prompt for delete too or just auto delete? Probably prmopt for now
			}, function(){
				Ext.Viewport.setMasked(false);
				Ext.Msg.alert('Error', 'Failed To Transfer File To Device');
			});
		}, function(err) {
			Ext.Viewport.setMasked(false);
			Ext.Msg.alert('Error', 'Failed To Create The  Directory' + err.code);
		});
	}, function(err) {
		Ext.Viewport.setMasked(false);
		Ext.Msg.alert('Error', 'Failed To Resolve File System URL on Android: ' + err.code);
	});	
};

Theta.prototype.generateImageThumbnail = function(file_uri){
	var me = this;
	var ogImage = new Image();
	var MAX_HEIGHT = 125;
	ogImage.onload = function() {
		//create the canvas object
		var canvas = document.createElement('canvas');
		//figure the image ratio
		if (ogImage.height > MAX_HEIGHT) {
			ogImage.width *= MAX_HEIGHT / ogImage.height;
			ogImage.height = MAX_HEIGHT;
		}
		//setup the canvas and draw the image to it.
		ctx = canvas.getContext("2d");
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		canvas.width = ogImage.width;
		canvas.height = ogImage.height;
		ctx.drawImage(ogImage, 0, 0, ogImage.width, ogImage.height);
		window.canvas2ImagePlugin.saveImageDataToLibrary(function(thuURI) {
			//me.thumb_uri = thuURI;
			//Store the photo and thumb
			//may one day have to prepend 'file://' to thuURI
			me.addToDatabase(file_uri, thuURI);

			//clear the canvas
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}, function(err) {
			Ext.Msg.alert('Error', 'Could Not Save Image Thumbnail. Error: ' + err);
		}, canvas);
	};
	ogImage.src = file_uri;
};

Theta.prototype.addToDatabase = function(file_uri, thumb_uri){
	var me = this;
	var sql = "INSERT INTO media (entity_id, survey_id, category_id, module_id, file_uri, thu_uri, uploaded) VALUES (?, ?, ?, ?, ?, ?, ?)";
	var data = [window.localStorage.getItem('currentSiteID'), null, 394, 40, file_uri,thumb_uri, 0];
	slm.app.offlineDB.transaction(function(transaction) {
		transaction.executeSql(sql, data, function() {
			Ext.Viewport.setMasked(false);
			console.log('Saved Theta Photo TO Database');
		}, function(){
			console.log('Error saving photo to database, this should likely be handled in the generic database error');
			Ext.Msg.alert('Error', 'Failed To Save Photo To Database');
		});
	});
};

Theta.prototype.deleteFileFromTheta = function(file){
	var files = [];
	files.push(file);
	var me = this;
	
	var params = {
		"name": "camera.delete",
		"parameters" : {
			"fileUrls": files
		}
	};
	 cordova.plugin.http.setDataSerializer("json");
	 cordova.plugin.http.post(me.thetaOSCPath, params, me.defaultHeaders, function(response) {
		console.log('Deleted Theta File');
		response.data = JSON.parse(response.data);
		console.log(response);
	}, function(response) {
		console.log('Failed To Delete Theta File');
		me.error('Failed To Delete Theta File', response);
	});
};

Theta.prototype.error = function(message, details){
	Ext.Viewport.setMasked(false);
	Ext.Msg.alert('Error', message);
	if(details){
		console.log(details);	
	}
};
