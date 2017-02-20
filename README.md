# Ricoh-Theta-S-Cordova
##IF YOU VALUE YOU SANITY AT ALL MAKE SURE YOUR RICOH FIRMWARE IS UP TO DATE!
This requires 2 Cordova Plugins: 
http-advanced-2 (allows us to set JSON data in a post request instead of FORM data)
https://github.com/silkimen/cordova-plugin-advanced-http
wifiwizard to do cool wifiy stuff. This isn't IOS compatible as far as I can tell...who knows apple sucks.
https://github.com/hoerresb/WifiWizard

Wifi Wizard Plugin from here: https://github.com/hoerresb/WifiWizard
This really just helps simplefy the connection process. In the code, it searches for the Theta wifi SSID, pulls out the serial number and uses that for the password. This won't work if the password or SSID has been changed (not sure if it is possible to change the SSID). 

2) I'm using Sencha EXTJS 6 Modern framework for building the app UI. So you'll see some references below on those pieces. (Ext.VIewport and stuff, totally not needed for most people).

So whats my thought process here on this code step by step:
1a) simply scan for the Wifi (Theta.connectToTheta())
1b) Find a Theta wifi (Theta.ScaForWiFiAPs())
1c) Connect To Theta Wifi. Grab the serial number for the password. Connect to the Theta Wifi (Theta.connectToThetaWifi())

2)Start the camera session (Theta.initCameraConnection() calls Theta.startCameraSession())
3) Set the API level (Theta.setThetaAPILevel(), this always set to level 2)
4) Grab a picture (Theta.takePhoto())
5) List the files into a view (Theta.getThetaFileList())
6) Get a selected photo onto the device(Theta.downloadCameraPhotoToDevice(file_url))
7) Remove the photo from the Theta (Theta.deleteFileFromTheta(file))
