/*

Configuration Sample:
"platforms": [
{
    "platform": "yamaha-home",
    "discovery_timeout": 5,
    "radio_presets": true,
    "preset_num": true,
    "max_volume": 10
}

*/

"use strict";

var Accessory, Service, Characteristic, UUIDGen, hap;
// var inherits = require('util').inherits;
var debug = require('debug')('yamaha-home');
var util = require('./lib/util.js');
var Yamaha = require('yamaha-nodejs');
var Q = require('q');
var bonjour = require('bonjour')();
var ip = require('ip');
var sysIds = {};
var accessories = [];

module.exports = function(homebridge) {
  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  hap = homebridge.hap;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;
  homebridge.registerPlatform("homebridge-yamaha-home", "yamaha-home", YamahaAVRPlatform, true);
};

function YamahaAVRPlatform(log, config, api) {
  this.log = log;
  this.config = config;
  this.api = api;

  this.zone = config["zone"] || "Main";
  this.playVolume = config["play_volume"];
  this.minVolume = config["min_volume"] || -80.0;
  this.maxVolume = config["max_volume"] || 20.0;
  this.gapVolume = this.maxVolume - this.minVolume;
  this.setMainInputTo = config["setMainInputTo"];
  this.discoveryTimeout = config["discovery_timeout"] || 10;
  this.manualAddresses = config["manual_addresses"] || {};
  // this.spotifyControls = config["spotify"] || false;
  this.nozones = config["nozones"] || false;

  this.zoneControllersOnlyFor = config["zone_controllers_only_for"] || null;

  this.api.on('didFinishLaunching', this.didFinishLaunching.bind(this));
}

YamahaAVRPlatform.prototype.configureAccessory = function(accessory) {
  debug("configureAccessory", accessory);
};

YamahaAVRPlatform.prototype.didFinishLaunching = function() {
  this.log("Getting Yamaha AVR devices.");
  var that = this;

  var browser = bonjour.find({
    type: 'http'
  }, setupFromService.bind(this));

  var timer = 0;
  var timeElapsed = 0;
  var checkCyclePeriod = 5000;

  // process manually specified devices...
  for (var key in this.manualAddresses) {
    if (!this.manualAddresses.hasOwnProperty(key)) continue;
    debug("THIS-0", this);
    setupFromService.call(this, {
      name: key,
      host: this.manualAddresses[key],
      port: 80
    });
  }

  // The callback can only be called once...so we'll have to find as many as we can
  // in a fixed time and then call them in.
  var timeoutFunction = function() {
    if (accessories.length >= that.expectedDevices) {
      clearTimeout(timer);
    } else {
      timeElapsed += checkCyclePeriod;
      if (timeElapsed > that.discoveryTimeout * 1000) {
        that.log("Waited " + that.discoveryTimeout + " seconds, stopping discovery.");
      } else {
        timer = setTimeout(timeoutFunction, checkCyclePeriod);
        return;
      }
    }
    browser.stop();
    that.log("Discovery finished, found " + accessories.length + " Yamaha AVR devices.");
    that.api.publishExternalAccessories("yamaha-home", accessories);
  };
  timer = setTimeout(timeoutFunction, checkCyclePeriod);
};

function setupFromService(service) {
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
  var yamaha = new Yamaha(service.host);
  yamaha.getSystemConfig().then(
    function(sysConfig) {
      // debug(JSON.stringify(sysConfig, null, 2));
      if (sysConfig && sysConfig.YAMAHA_AV) {
        var sysModel = sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0];
        var sysId = sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0];
        if (sysIds[sysId]) {
          this.log("WARN: Got multiple systems with ID " + sysId + "! Omitting duplicate!");
          return;
        }
        sysIds[sysId] = true;
        this.log("Found Yamaha " + sysModel + " - " + sysId + ", \"" + name + "\"");

        yamaha.getAvailableZones().then(
          function(zones) {
            // Only add zones control if more than 1 zone
            // Hack to always create a zone control
            // TODO: Remove if block
            if (zones.length > 0 && !this.nozones) {
              for (var zone in zones) {
                yamaha.getBasicInfo(zones[zone]).then(function(basicInfo) {
                  if (basicInfo.getVolume() !== -999) {
                    yamaha.getZoneConfig(basicInfo.getZone()).then(
                      function(zoneInfo) {
                        if (zoneInfo) {
                          var z = Object.keys(zoneInfo.YAMAHA_AV)[1];
                          var zoneName = zoneInfo.YAMAHA_AV[z][0].Config[0].Name[0].Zone[0];
                        } else {
                          var zoneName = "Main_Zone";
                        }
                        if (this.zoneControllersOnlyFor == null || this.zoneControllersOnlyFor.includes(zoneName)) {
                          this.log("Adding TV Control for", zoneName);
                          var uuid = UUIDGen.generate(zoneName + "Y");
                          var zoneAccessory = new Accessory(zoneName + "Y", uuid, hap.Accessory.Categories.TELEVISION);
                          var accessory = new YamahaZone(this.log, this.config, zoneName, yamaha, sysConfig, z, zoneAccessory);
                          accessory.getServices();
                          accessories.push(zoneAccessory);
                        }
                      }.bind(this)
                    );
                  }
                }.bind(this));
              }
            }
          }.bind(this)
        );
      }
    }.bind(this),
    function(error) {
      this.log("DEBUG: Failed getSystemConfig from " + name + ", probably just not a Yamaha AVR.");
    }.bind(this)
  );
}

function YamahaZone(log, config, name, yamaha, sysConfig, zone, accessory) {
  this.log = log;
  this.config = config;
  this.name = name;
  this.yamaha = yamaha;
  this.sysConfig = sysConfig;
  this.zone = zone;
  this.accessory = accessory;

  this.radioPresets = config["radio_presets"] || false;
  this.presetNum = config["preset_num"] || false;
  this.minVolume = config["min_volume"] || -80.0;
  this.maxVolume = config["max_volume"] || -10.0;
  this.gapVolume = this.maxVolume - this.minVolume;
}

YamahaZone.prototype = {

  setPlaying: function(playing) {
    var that = this;
    var yamaha = this.yamaha;

    if (playing) {
      return yamaha.powerOn(that.zone).then(function() {
        if (that.playVolume) return yamaha.setVolumeTo(that.playVolume * 10, that.zone);
        else return Q();
      }).then(function() {
        if (that.setMainInputTo) return yamaha.setMainInputTo(that.setMainInputTo);
        else return Q();
      }).then(function() {
        if (that.setMainInputTo === "AirPlay") {
          return yamaha.SendXMLToReceiver(
            '<YAMAHA_AV cmd="PUT"><AirPlay><Play_Control><Playback>Play</Playback></Play_Control></AirPlay></YAMAHA_AV>'
          );
        } else {
          return Q();
        }
      });
    } else {
      return yamaha.powerOff(that.zone);
    }
  },

  getServices: function() {
    var that = this;
    var yamaha = this.yamaha;

    var informationService = this.accessory.services[0];

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(Characteristic.Model, this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0])
      .setCharacteristic(Characteristic.FirmwareRevision, require('./package.json').version)
      .setCharacteristic(Characteristic.SerialNumber, this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]);

    // for main zone Only
    if (this.zone === "Main_Zone") {
      // Party Mode switch

      var partySwitch = new Service.Switch("Party", UUIDGen.generate("Party"), "Party");
      partySwitch
        .getCharacteristic(Characteristic.On)
        .on('get', function(callback) {
          debug("getPartySwitch", that.zone);
          this.yamaha.isPartyModeEnabled().then(function(result) {
            callback(null, result);
          });
        }.bind(this))
        .on('set', function(on, callback) {
          debug("setPartySwitch", that.zone, on);
          if (on) {
            const that = this;
            this.yamaha.powerOn().then(function() {
              that.yamaha.partyModeOn().then(function() {
                callback(null, true);
              });
            });
          } else {
            this.yamaha.partyModeOff().then(function() {
              callback(null, false);
            });
          }
        }.bind(this));
      this.accessory.addService(partySwitch);

      // Radio Preset buttons

      if (this.radioPresets) {
        yamaha.getTunerPresetList().then(function(presets) {
          for (var preset in presets) {
            this.log("Adding preset %s - %s", preset, presets[preset].value, this.presetNum);
            if (!this.presetNum) {
              // preset by frequency
              var presetSwitch = new Service.Switch(presets[preset].value, UUIDGen.generate(presets[preset].value), presets[preset].value);
            } else {
              // preset by button
              var presetSwitch = new Service.Switch(preset, UUIDGen.generate(preset), preset);
            }
            presetSwitch.context = {};

            presetSwitch.context.preset = preset;
            presetSwitch
              .getCharacteristic(Characteristic.On)
              .on('get', function(callback, context) {
                debug("getPreset", this);
                yamaha.getBasicInfo().then(function(basicInfo) {
                  // debug('YamahaSwitch Is On', basicInfo.isOn()); // True
                  // debug('YamahaSwitch Input', basicInfo.getCurrentInput()); // Tuner

                  if (basicInfo.isOn() && basicInfo.getCurrentInput() === 'TUNER') {
                    yamaha.getTunerInfo().then(function(result) {
                      // console.log( 'TunerInfo', JSON.stringify(result,null, 0));
                      debug(result.Play_Info[0].Feature_Availability[0]); // Ready
                      debug(result.Play_Info[0].Search_Mode[0]); // Preset
                      debug(result.Play_Info[0].Preset[0].Preset_Sel[0]); // #
                      if (result.Play_Info[0].Feature_Availability[0] === 'Ready' &&
                        result.Play_Info[0].Search_Mode[0] === 'Preset' &&
                        result.Play_Info[0].Preset[0].Preset_Sel[0] === this.context.preset) {
                        callback(null, true);
                      } else {
                        callback(null, false);
                      }
                    }.bind(this));
                  } else {
                    // Off
                    callback(null, false);
                  }
                }.bind(this), function(error) {
                  callback(error);
                });
              }.bind(presetSwitch))
              .on('set', function(powerOn, callback) {
                debug("setPreset", this);
                yamaha.setMainInputTo("TUNER").then(function() {
                  return yamaha.selectTunerPreset(this.context.preset).then(function() {
                    debug('Tuning radio to preset %s - %s', this.preset, this.name);
                    callback(null, 1);
                  }.bind(this));
                }.bind(this));
              }.bind(presetSwitch));

            // debug("Bind", this, presetSwitch);
            this.accessory.addService(presetSwitch);
          }
        }.bind(this)).bind(this);
      }
    }

    var zoneService = new Service.Television(this.name);
    zoneService.setCharacteristic(Characteristic.ConfiguredName, this.name);
    zoneService.getCharacteristic(Characteristic.Active)
      .on('get', function(callback, context) {
        debug("getActive", that.zone);
        yamaha.isOn(that.zone).then(
          function(result) {
            callback(null, result);
          },
          function(error) {
            callback(error, false);
          }
        );
      })
      .on('set', function(powerOn, callback) {
        debug("setActive", that.zone, powerOn);
        this.setPlaying(powerOn).then(function() {
          callback(null, powerOn);
        }, function(error) {
          callback(error, !powerOn); // TODO: Actually determine and send real new status.
        });
      }.bind(this));

    // zoneService.setCharacteristic(Characteristic.ActiveIdentifier, 1);

    yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
      debug('YamahaSwitch Is On', basicInfo.isOn()); // True
      debug('YamahaSwitch Input', basicInfo.getCurrentInput());
      zoneService.getCharacteristic(Characteristic.ActiveIdentifier).updateValue(util.Inputs.find(function(input) {
        return (input.ConfiguredName === basicInfo.getCurrentInput() ? input : false);
      }).Identifier);
    });

    zoneService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .on('get', function(callback) {
        // debug("getActiveIdentifier", that.zone);
        yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
          debug("getActiveIdentifier Input", that.zone, basicInfo.getCurrentInput());
          callback(null, util.Inputs.find(function(input) {
            return (input.ConfiguredName === basicInfo.getCurrentInput() ? input : false);
          }).Identifier);
        });
        // callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setActiveIdentifier => setNewValue: ", that.zone, newValue);
        yamaha.setInputTo(util.Inputs.find(function(input) {
          // debug("find %s === %s", input.Identifier, newValue);
          return (input.Identifier === newValue ? input : false);
        }).ConfiguredName, that.zone).then(function(a, b) {
          debug("setActiveIdentifier", that.zone, a, b);
          callback();
        });
        // callback(null);
      });

    // Spotify / Airplay controls
    zoneService
      .getCharacteristic(Characteristic.RemoteKey)
      .on('set', function(newValue, callback) {
        debug("setRemoteKey: ", that.zone, newValue);
        var option = util.mapKeyToControl(newValue);
        if (option) {
          debug("command", that.zone, newValue, option, this.pausePlay);
          yamaha.SendXMLToReceiver('<YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>' + option + '</Playback></Play_Control></Spotify></YAMAHA_AV>').then(function(status) {
            debug("Status", that.zone, status);
          });
        }
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.CurrentMediaState)
      .on('get', function(callback) {
        debug("getCurrentMediaState", that.zone);
        callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setCurrentMediaState => setNewValue: " + newValue);
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.TargetMediaState)
      .on('get', function(callback) {
        debug("getTargetMediaState", that.zone);
        callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("setTargetMediaState => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.PictureMode)
      .on('set', function(newValue, callback) {
        debug("setPictureMode => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    zoneService
      .getCharacteristic(Characteristic.PowerModeSelection)
      .on('set', function(newValue, callback) {
        debug("setPowerModeSelection => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    this.accessory.addService(zoneService);

    util.Inputs.forEach(function(input) {
      // debug("Adding input", this.name, input.ConfiguredName);
      var inputService = new Service.InputSource(input.ConfiguredName, UUIDGen.generate(this.name + input.ConfiguredName), input.ConfiguredName);

      inputService
        .setCharacteristic(Characteristic.Identifier, input.Identifier)
        .setCharacteristic(Characteristic.ConfiguredName, input.ConfiguredName)
        .setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(Characteristic.InputSourceType, input.InputSourceType)
        .getCharacteristic(Characteristic.TargetVisibilityState)
        .on('set', function(newValue, callback) {
          debug("setTargetVisibilityState => setNewValue: ", that.zone, newValue);
          callback(null);
        });

      zoneService.addLinkedService(inputService);
      this.accessory.addService(inputService);
      // debug(JSON.stringify(inputService, null, 2));
    }.bind(this));

    var speakerService = new Service.TelevisionSpeaker(this.name);

    speakerService
      .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
      .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);
    // .setCharacteristic(Characteristic.Volume, 50);

    speakerService.getCharacteristic(Characteristic.Volume)
      .on('get', function(callback) {
        debug("get Volume", that.zone);
        callback(null);
      })
      .on('set', function(newValue, callback) {
        debug("set Volume => setNewValue: ", that.zone, newValue);
        callback(null);
      });

    yamaha.getBasicInfo(that.zone).then(function(basicInfo) {
      var v = basicInfo.getVolume() / 10.0;
      var p = 100 * ((v - that.minVolume) / that.gapVolume);
      p = p < 0 ? 0 : p > 100 ? 100 : Math.round(p);
      debug("Got volume percent of " + p + "%", that.zone);
      speakerService.getCharacteristic(Characteristic.Volume).updateValue(p);
    });

    speakerService.getCharacteristic(Characteristic.VolumeSelector)
      .on('set', function(newValue, callback) {
        var volume = speakerService.getCharacteristic(Characteristic.Volume).value;
        // debug(volume, speakerService.getCharacteristic(Characteristic.Volume));
        volume = volume + (newValue ? -1 : +1);
        speakerService.getCharacteristic(Characteristic.Volume).updateValue(volume);
        var v = ((volume / 100) * that.gapVolume) + that.minVolume;
        v = Math.round(v) * 10.0;
        debug("Setting volume to ", that.zone, v / 10);
        yamaha.setVolumeTo(v, that.zone).then(function(status) {
          debug("Status", that.zone, status);
        });
        debug("set VolumeSelector => setNewValue: ", that.zone, newValue, volume);
        callback(null);
      });

    this.accessory.addService(speakerService);
  }
};
