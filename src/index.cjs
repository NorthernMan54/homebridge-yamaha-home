// 'use strict';
var inherits = require('util').inherits;
var debug = require('debug')('yamaha-home');
var Yamaha = require('yamaha-nodejs');
var Q = require('q');
var bonjour = require('bonjour')();
var ip = require('ip');

var YamahaZone = require('./YamahaZone.cjs');
var sysIds = {};

const PLUGIN_NAME = 'homebridge-yamaha-home';
const PLATFORM_NAME = 'yamaha-home';

module.exports = function (api) {

  //fixInheritance(YamahaAVRPlatform.Input, Characteristic);
  //fixInheritance(YamahaAVRPlatform.InputName, Characteristic);
  //fixInheritance(YamahaAVRPlatform.InputService, Service);

  //  homebridge.registerAccessory("homebridge-yamaha", "YamahaAVR", YamahaAVRAccessory);
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, YamahaAVRPlatform);
};

// Necessary because Accessory is defined after we have defined all of our classes
function fixInheritance(subclass, superclass) {
  var proto = subclass.prototype;
  inherits(subclass, superclass);
  subclass.prototype.parent = superclass.prototype;
  for (var mn in proto) {
    subclass.prototype[mn] = proto[mn];
  }
}

class YamahaAVRPlatform {
  constructor(log, config, api) {
    this.api = api;
    this.log = log;
    this.config = config;
    this.zone = config["zone"] || "Main";
    this.playVolume = config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";
    this.setMainInputTo = config["setMainInputTo"];
    this.expectedDevices = config["expected_devices"] || 100;
    this.discoveryTimeout = config["discovery_timeout"] || 10;
    this.radioPresets = config["radio_presets"] || false;
    this.presetNum = config["preset_num"] || false;
    this.manualAddresses = config["manual_addresses"] || {};
    this.spotifyControls = config["spotify"] || false;
    this.nozones = config["nozones"] || false;
    // this.partySwitch is nessesary for optional Party Mode Switch
    this.partySwitch = config["party_switch"];
    // this.inputAccessories is nessesary for optional Inputs Switches
    this.inputAccessories = config["inputs_as_accessories"] || {};
    this.zoneControllersOnlyFor = config["zone_controllers_only_for"] || null;

    this.receivers = [];

    api.on('didFinishLaunching', this.didFinishLaunching);


  }

  didFinishLaunching = () => {
    this.log("Getting Yamaha AVR devices.");

    var browser = bonjour.find({
      type: 'http'
    }, (service) => this.setupFromService(service));

    var timer, timeElapsed = 0, checkCyclePeriod = 5000;

    // process manually specified devices...
    for (var key in this.manualAddresses) {
      if (!this.manualAddresses.hasOwnProperty(key)) continue;
      debug("THIS-0", this);
      this.setupFromService({
        name: key,
        host: this.manualAddresses[key],
        port: 80
      });
    }

    // The callback can only be called once...so we'll have to find as many as we can
    // in a fixed time and then call them in.
    var timeoutFunction = () => {
      if (this.receivers.length >= this.expectedDevices) {
        clearTimeout(timer);
      } else {
        timeElapsed += checkCyclePeriod;
        if (timeElapsed > this.discoveryTimeout * 1000) {
          this.log("Waited " + this.discoveryTimeout + " seconds, stopping discovery.");
        } else {
          timer = setTimeout(timeoutFunction, checkCyclePeriod);
          return;
        }
      }
      browser.stop();
      this.log("Discovery finished, found " + this.receivers.length + " Yamaha AVR devices.");
      console.log(this.receivers)
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.receivers);
    };
    timer = setTimeout(timeoutFunction, checkCyclePeriod);
  };

  configureAccessory(accessory) {
    this.log("Configuring accessory", accessory.displayName);
    console.log("Configuring accessory", accessory);
    this.receivers.push(accessory);

  }


  async setupFromService(service) {
    // Looking for name, host and port
    this.log("Possible Yamaha device discovered", service.name, service.addresses);
    if (service.addresses) {
      for (let address of service.addresses) {
        if (ip.isV4Format(address)) {
          service.host = address;
          break;
        }
      }
    }

    var name = service.name;
    // console.log('Found HTTP service "' + name + '"');
    // We can't tell just from mdns if this is an AVR...
    if (service.port !== 80) return; // yamaha-nodejs assumes this, so finding one on another port wouldn't do any good anyway.
    debug("Is this a Yamaha ?", service.name, service.host);
    var yamaha = new Yamaha(service.host);

    var systemConfig = await yamaha.getSystemConfig().catch(error => { return null; }); // If we can't get the system config, it's not a Yamaha AVR.

    if (systemConfig && systemConfig.YAMAHA_AV) {
      this.createReceiver(name, yamaha, systemConfig);
    } else {
      this.log("DEBUG: Failed getSystemConfig from " + name + ", probably just not a Yamaha AVR.");
    }
  };

  async createReceiver(name, yamaha, sysConfig) {
    // debug("SysConfig -> %s ->", name, JSON.stringify(sysConfig, null, 2));
    var sysModel = sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0];
    var sysId = sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0];
    if (sysIds[sysId]) {
      this.log("WARN: Got multiple systems with ID " + sysId + "! Omitting duplicate!");
      return;
    }
    sysIds[sysId] = true;
    this.log("Found Yamaha " + sysModel + " - " + sysId + ", \"" + name + "\"");

    if (this.nozones) {
      var accessory = new YamahaAVRAccessory(this.log, this.config, name, yamaha, sysConfig);
      this.receivers.push(accessory);
    }

    // Conditional statement. If we have any inputs in config.json property "inputs_as_accessories" this will create those switches.
    // Functionality added via YamahaInputService contructor function
    /*
    "inputs_as_accessories": {
            "Family": {
                "1": {
                    "name": "AppleTV-Test",
                    "setInputTo": "AppleTV"
                }
            }
        }
    */
    this.log('Checking for \'inputs_as_accessories\' for receiver \'%s\'', name);
    if (this.inputAccessories.hasOwnProperty(name)) {
      for (var key in this.inputAccessories) {
        var inputs = this.inputAccessories[key];  // YamahaReceiver
        for (var key in inputs) {                 // 1
          var inputConfig = inputs[key];
          var input = parseInt(key);
          var accname = inputConfig["name"];
          this.log.info("Making accessory \"" + accname + "\" for input " + input);
          var accessory = new YamahaInputService(this.log, inputConfig, accname, yamaha, sysConfig, input);
          this.receivers.push(accessory);
          if (this.receivers.length >= this.expectedDevices)
            timeoutFunction(); // We're done, call the timeout function now.
        }
      }
    }

    // Adding accessory with YamahaParty Switch.
    // Depends on "party_switch" property in config.json. if "yes" => Party Mode Switch exists.
    if (this.partySwitch === 'yes') {
      var accessory = new YamahaParty(this.log, this.config, name, yamaha, sysConfig);
      this.receivers.push(accessory);
    }

    // <YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>Skip Fwd</Playback></Play_Control></Spotify></YAMAHA_AV>
    // <YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>Skip Rev</Playback></Play_Control></Spotify></YAMAHA_AV>
    // <YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>Pause</Playback></Play_Control></Spotify></YAMAHA_AV>
    // <YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>Play</Playback></Play_Control></Spotify></YAMAHA_AV>

    if (this.spotifyControls) {
      // Creates an accesory with a button for each control
      var accessory = new YamahaSpotify(this.log, this.config, name, yamaha, sysConfig);
      this.receivers.push(accessory);
    }


    var zones = await yamaha.getAvailableZones();
    if (zones.length > 0 && !this.nozones) {
      for (var zone in zones) {
        var basicInfo = await yamaha.getBasicInfo(zones[zone]);
        if (basicInfo.getVolume() !== -999) {
          var zoneInfo = await yamaha.getZoneConfig(basicInfo.getZone());
          if (zoneInfo) {
            var z = Object.keys(zoneInfo.YAMAHA_AV)[1];
            var zoneName = zoneInfo.YAMAHA_AV[z][0].Config[0].Name[0].Zone[0];
          } else {
            var zoneName = "Main_Zone";
          }
          if (this.zoneControllersOnlyFor == null || this.zoneControllersOnlyFor.includes(zoneName)) {
            this.log("Adding zone controller for", zoneName);
            var accessory = new YamahaZone(this, zoneName, yamaha, sysConfig, z);
            this.receivers.push(accessory.getAccessory());
          }
        }
      }
    }

    // Add buttons for each preset

    if (this.radioPresets) {
      yamaha.getTunerPresetList().then(function (presets) {
        for (var preset in presets) {
          this.log("Adding preset %s - %s", preset, presets[preset].value, this.presetNum);
          if (!this.presetNum) {
            // preset by frequency
            var accessory = new YamahaSwitch(this.log, this.config, presets[preset].value, yamaha, sysConfig, preset);
          } else {
            // Preset by number
            var accessory = new YamahaSwitch(this.log, this.config, preset, yamaha, sysConfig, preset);
          }
          // this.receivers.push(accessory);
        }
      }.bind(this));
    }
  }




  // Custom Characteristics and service...
  static Input() {
    Characteristic.call(this, 'Input', '00001003-0000-1000-8000-135D67EC4377');
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
  static InputName() {
    Characteristic.call(this, 'Input Name', '00001004-0000-1000-8000-135D67EC4377');
    this.setProps({
      format: Characteristic.Formats.STRING,
      perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
    });
    this.value = this.getDefaultValue();
  }
  static InputService(displayName, subtype) {
    Service.call(this, displayName, '00000002-0000-1000-8000-135D67EC4377', subtype);

    // Required Characteristics
    this.addCharacteristic(YamahaAVRPlatform.Input);

    // Optional Characteristics
    this.addOptionalCharacteristic(YamahaAVRPlatform.InputName);
  }
}

// Party Mode Switch
class YamahaParty {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Party Mode";
    this.zone = config["zone"] || 1;
    this.name = "Party Mode";
    this.serviceName = name;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";

    this.log("Adding Party Switch %s", name);
  }
  getServices() {
    var that = this;
    var informationService = new Service.AccessoryInformation();
    // var yamaha = this.yamaha;
    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    var partyService = new Service.Switch(this.name);
    partyService.getCharacteristic(Characteristic.On)
      .on('get', function (callback) {
        const that = this;
        this.yamaha.isPartyModeEnabled().then(function (result) {
          callback(null, result);
        });
      }.bind(this))
      .on('set', function (on, callback) {
        if (on) {
          const that = this;
          this.yamaha.powerOn().then(function () {
            that.yamaha.partyModeOn().then(function () {
              callback(null, true);
            });
          });
        } else {
          this.yamaha.partyModeOff().then(function () {
            callback(null, false);
          });
        }
      }.bind(this));
    return [informationService, partyService];
  }
}


// Spotify controls

class YamahaSpotify {
  constructor(log, config, name, yamaha, sysConfig) {
    // debug("config %s\nyamaha %s\nsysConfig %s", JSON.stringify(config), JSON.stringify(yamaha), JSON.stringify(sysConfig));
    // var buttons = ["Play", "Pause", "Skip Fwd", "Skip Rev"];
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Party Mode";
    this.zone = config["zone"] || 1;
    this.name = "Spotify (" + name + ")";
    this.serviceName = name;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";

    this.log("Adding spotify button %s", this.name);
  }
  getServices() {
    var services = [];
    var informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);
    services.push(informationService);
    ["Play", "Pause", "Skip Fwd", "Skip Rev"].forEach(function (button) {
      // debug("THIS", this);
      var spotifyButton = new Service.Switch(button + " (" + this.serviceName + ")");
      spotifyButton.subtype = button;
      spotifyButton.yamaha = this.yamaha;
      debug("Adding Spotify Button", spotifyButton.displayName);
      spotifyButton.getCharacteristic(Characteristic.On)
        .on('set', function (on, callback) {
          // debug("THIS", this);
          debug("Spotify Control", this.displayName);
          if (on) { // <YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>Play                </Playback></Play_Control></Spotify></YAMAHA_AV>
            this.yamaha.SendXMLToReceiver('<YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>' + this.subtype + '</Playback></Play_Control></Spotify></YAMAHA_AV>');
            setTimeout(function () {
              this.setCharacteristic(Characteristic.On, 0);
            }.bind(this), 5 * 1000); // After 1 second turn off
          }
          callback(null, on);
        }.bind(spotifyButton));
      services.push(spotifyButton);
    }.bind(this));

    return services;
  }
}


// Inputs or Scenes as additional Switches.

class YamahaInputService {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Party Mode";
    this.zone = config["zone"] || 1;
    this.name = name;
    this.setDefaultVolume = config["set_default_volume"];
    this.serviceName = name;
    this.defaultServiceName = config["default_service_name"];
    this.defaultServiceName = this.serviceName;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";

    this.setInputTo = config["setInputTo"] || config["setMainInputTo"];
    this.setScene = config["set_scene"] || {}; // Scene Feature
    this.log("Adding Input Switch %s", name);
  }
  // Prototype function runs for each switch specified in config json file. Loop syntax is in function setupFromService(service). Currently line 189.
  getServices() {
    var that = this;
    var informationService = new Service.AccessoryInformation();
    var yamaha = this.yamaha;

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    var inputSwitchService = new Service.Switch(this.name);
    this.inputSwitchService = inputSwitchService;
    inputSwitchService.getCharacteristic(Characteristic.On)
      .on('get', function (callback, context) {
        this.yamaha.getCurrentInput().then(
          function (result) {
            // that.log(result) //This logs the current Input. Needed for testing.
            // Conditional statement below checks the current input. If input 1 is active, all other inputs in Home App become not active.
            // When swithing input from 1 to 3, input 3 becomes active and input 1 becomes not active. (input numbers are for example)
            if (result !== that.setInputTo) {
              // that.log("Current Input: " + result + "!== to Button input:" + that.setInputTo). Needed for testing.
              callback(null, false);
            } else if (result === that.setInputTo) {
              callback(null, true);
              // that.log("Current Input: " + result + "=== to Button input:" + that.setInputTo). Needed for testing.
            }
          }
        );
      }.bind(this))
      .on('set', function (on, callback) {
        if (on) {
          debug('Setting Input', this.setInputTo);
          var that = this;
          this.yamaha.powerOn().then(function () {
            that.yamaha.setMainInputTo(that.setInputTo).then(function () {
              // This will set the scene
              that.yamaha.SendXMLToReceiver('<YAMAHA_AV cmd="PUT"><Main_Zone><Scene><Scene_Sel>Scene ' + that.setScene + '</Scene_Sel></Scene></Main_Zone></YAMAHA_AV>').then(function () {
                // This will set the input
                that.yamaha.setVolumeTo(that.setDefaultVolume * 10, this.zone).then(function () {
                  callback(null);
                });
              });
            });
          });
        } else {
          callback(null);
        }
        setTimeout(function () {
          this.inputSwitchService.setCharacteristic(Characteristic.On, 0);
        }.bind(this), 5 * 1000); // After 1 second turn off
      }.bind(this));

    return [informationService, inputSwitchService];
  }
}


class YamahaSwitch {
  constructor(log, config, name, yamaha, sysConfig, preset) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Speakers";
    this.zone = config["zone"] || 1;
    this.name = 'Preset ' + parseInt(name).toString();
    this.serviceName = name + this.nameSuffix;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";
    this.preset = preset;
  }
  getServices() {
    var that = this;
    var informationService = new Service.AccessoryInformation();
    var yamaha = this.yamaha;

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    var switchService = new Service.Switch(this.name);
    switchService.getCharacteristic(Characteristic.On)
      .on('set', function (powerOn, callback) {
        if (powerOn) {
          yamaha.setMainInputTo("TUNER").then(function () {
            return yamaha.selectTunerPreset(this.preset).then(function () {
              this.log('Tuning radio to preset %s - %s', this.preset, this.name);
              setTimeout(function () {
                this.setCharacteristic(Characteristic.On, 0);
              }.bind(switchService), 5 * 1000); // After 1 second turn off
              callback(null);
            }.bind(this));
          }.bind(this));
        } else {
          callback(null);
        };
      }.bind(this));

    return [informationService, switchService];
  }
}

class YamahaAVRAccessory {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Speakers";
    this.zone = config["zone"] || 1;
    this.name = name;
    this.serviceName = name + this.nameSuffix;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";
  }
  setPlaying(playing) {
    var that = this;
    var yamaha = this.yamaha;

    if (playing) {
      return yamaha.powerOn("System").then(function () {
        if (that.playVolume) return yamaha.setVolumeTo(that.playVolume * 10, that.zone);
        else return Q();
      }).then(function () {
        if (that.setMainInputTo) return yamaha.setMainInputTo(that.setMainInputTo);
        else return Q();
      }).then(function () {
        if (that.setMainInputTo === "AirPlay") return yamaha.SendXMLToReceiver(
          '<YAMAHA_AV cmd="PUT"><AirPlay><Play_Control><Playback>Play</Playback></Play_Control></AirPlay></YAMAHA_AV>'
        );
        else return Q();
      });
    } else {
      return yamaha.powerOff("System");
    }
  }
  getServices() {
    var that = this;
    var informationService = new Service.AccessoryInformation();
    var yamaha = this.yamaha;

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('../package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    var switchService = new Service.Switch("Yamaha Power");
    switchService.getCharacteristic(Characteristic.On)
      .on('get', function (callback, context) {
        yamaha.isOn().then(
          function (result) {
            callback(null, result);
          }.bind(this),
          function (error) {
            callback(error, false);
          }.bind(this)
        );
      }.bind(this))
      .on('set', function (powerOn, callback) {
        this.setPlaying(powerOn).then(function () {
          callback(null);
        }, function (error) {
          callback(error); // TODO: Actually determine and send real new status.
        });
      }.bind(this));

    var mainService = new Service.Fan(this.name);
    mainService.getCharacteristic(Characteristic.On)
      .on('get', function (callback, context) {
        yamaha.isOn().then(
          function (result) {
            callback(null, result);
          }.bind(this),
          function (error) {
            callback(error, false);
          }.bind(this)
        );
      }.bind(this))
      .on('set', function (powerOn, callback) {
        this.setPlaying(powerOn).then(function () {
          callback(null);
        }, function (error) {
          callback(error); // TODO: Actually determine and send real new status.
        });
      }.bind(this));

    mainService.addCharacteristic(new Characteristic.RotationSpeed())
      .on('get', function (callback, context) {
        yamaha.getBasicInfo(that.zone).then(function (basicInfo) {
          var v = basicInfo.getVolume() / 10.0;
          var p = 100 * ((v - that.minVolume) / that.gapVolume);
          p = p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
          debug("Got volume percent of " + p + "%");
          callback(null, p);
        }, function (error) {
          callback(error, 0);
        });
      })
      .on('set', function (p, callback) {
        var v = ((p / 100) * that.gapVolume) + that.minVolume;
        v = Math.round(v) * 10.0;
        debug("Setting volume to " + v);
        yamaha.setVolumeTo(v, that.zone).then(function () {
          callback(null);
        }, function (error) {
          callback(error);
        });
      });


    var audioDeviceService = new Service.Speaker("Speaker");
    audioDeviceService.addCharacteristic(Characteristic.Volume);
    var volCx = audioDeviceService.getCharacteristic(Characteristic.Volume);

    volCx.on('get', function (callback, context) {
      yamaha.getBasicInfo(that.zone).then(function (basicInfo) {
        var v = basicInfo.getVolume() / 10.0;
        var p = 100 * ((v - that.minVolume) / that.gapVolume);
        p = p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
        debug("Got volume percent of " + p + "%");
        callback(null, p);
      }, function (error) {
        callback(error, 0);
      });
    })
      .on('set', function (p, callback) {
        var v = ((p / 100) * that.gapVolume) + that.minVolume;
        v = Math.round(v) * 10.0;
        debug("Setting volume to " + v);
        yamaha.setVolumeTo(v, that.zone).then(function () {
          callback(null);
        }, function (error) {
          callback(error);
        });
      })
      .getValue(null, null); // force an asynchronous get

    var mutingCx = audioDeviceService.getCharacteristic(Characteristic.Mute);

    mutingCx.on('get', function (callback, context) {
      yamaha.getBasicInfo(that.zone).then(function (basicInfo) {
        callback(null, basicInfo.isMuted());
      }, function (error) {
        callback(error, 0);
      });
    })
      .on('set', function (v, callback) {
        var zone_name = 'Main_Zone';
        if (that.zone != 1) {
          zone_name = 'Zone_' + that.zone;
        }

        var mute_xml = '<YAMAHA_AV cmd="PUT"><' + zone_name + '><Volume><Mute>';
        if (v) {
          mute_xml += 'On';
        } else {
          mute_xml += 'Off';
        }
        mute_xml += '</Mute></Volume></' + zone_name + '></YAMAHA_AV>';

        yamaha.SendXMLToReceiver(mute_xml).then(function () {
          callback(null);
        }, function (error) {
          callback(error);
        });
      })
      .getValue(null, null); // force an asynchronous get

    var inputService = new YamahaAVRPlatform.InputService("Input Functions");

    var inputCx = inputService.getCharacteristic(YamahaAVRPlatform.Input);
    inputCx.on('get', function (callback, context) {
      yamaha.getBasicInfo().then(function (basicInfo) {
        callback(null, basicInfo.getCurrentInput());
      }, function (error) {
        callback(error, 0);
      });
    })
      .getValue(null, null); // force an asynchronous get

    if (this.showInputName == "yes") {
      inputService.addCharacteristic(YamahaAVRPlatform.InputName);
      var nameCx = inputService.getCharacteristic(YamahaAVRPlatform.InputName);
      nameCx.on('get', function (callback, context) {
        yamaha.getBasicInfo().then(function (basicInfo) {
          var name = basicInfo.YAMAHA_AV.Main_Zone[0].Basic_Status[0].Input[0].Input_Sel_Item_Info[0].Src_Name[0];
          name = name.replace('Osdname:', '');
          callback(null, name);
        }, function (error) {
          callback(error, 0);
        });
      })
        .getValue(null, null); // force an asynchronous get
    }

    return [informationService, switchService, audioDeviceService, inputService, mainService];
  }
}


