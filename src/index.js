'use strict';

const debug = require('debug')('yamaha-home');
const Yamaha = require('yamaha-nodejs');
const bonjour = require('bonjour')();
const ip = require('ip');

const CachedYamaha = require('./CachedYamaha'); // Import CachedYamaha
const YamahaZone = require('./yamahaZone.js');
const YamahaParty = require('./YamahaParty.js');
const YamahaSpotify = require('./YamahaSpotify.js');
const YamahaInputService = require('./YamahaInputService.js');
const YamahaSwitch = require('./YamahaSwitch.js');
const YamahaAVRAccessory = require('./YamahaAvrAccessory.js');

const sysIds = {};

const PLUGIN_NAME = 'homebridge-yamaha-home';
const PLATFORM_NAME = 'yamaha-home';

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, YamahaAVRPlatform);
};

class YamahaAVRPlatform {
  constructor(log, config, api) {
    this.api = api;
    this.log = log;
    this.config = config;
    this.accessories = [];

    // Configuration properties
    const {
      zone = 'Main',
      play_volume,
      min_volume = -65.0,
      max_volume = -10.0,
      show_input_name = 'no',
      setMainInputTo,
      expected_devices = 100,
      discovery_timeout = 10,
      radio_presets = false,
      preset_num = false,
      manual_addresses = {},
      spotify = false,
      nozones = false,
      party_switch,
      inputs_as_accessories = {},
      zone_controllers_only_for = null,
      flush = false
    } = config;

    this.zone = zone;
    this.playVolume = play_volume;
    this.minVolume = min_volume;
    this.maxVolume = max_volume;
    this.gapVolume = max_volume - min_volume;
    this.showInputName = show_input_name;
    this.setMainInputTo = setMainInputTo;
    this.expectedDevices = expected_devices;
    this.discoveryTimeout = discovery_timeout;
    this.radioPresets = radio_presets;
    this.presetNum = preset_num;
    this.manualAddresses = manual_addresses;
    this.spotifyControls = spotify;
    this.nozones = nozones;
    this.partySwitch = party_switch;
    this.inputAccessories = inputs_as_accessories;
    this.zoneControllersOnlyFor = zone_controllers_only_for;
    this.flush = flush;
    this.receiverCount = 0;

    this.receivers = [];

    api.on('didFinishLaunching', this.didFinishLaunching);
  }

  didFinishLaunching = () => {
    if (this.flush) {
      this.log('Flushing cached receivers');
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
      this.accessories = [];
    }
    this.log('Getting Yamaha AVR devices.');

    const browser = bonjour.find({ type: 'http' }, (service) => this.setupFromService(service));

    let timer;
    let timeElapsed = 0;
    const checkCyclePeriod = 5000;

    // Process manually specified devices
    Object.entries(this.manualAddresses).forEach(([name, address]) => {
      this.setupFromService({ name, host: address, port: 80 });
    });

    const timeoutFunction = () => {
      if (this.receivers.length >= this.expectedDevices || timeElapsed > this.discoveryTimeout * 1000) {
        clearTimeout(timer);
        browser.stop();
        this.log.success(`Discovery finished, found ${this.receiverCount} Yamaha AVR's and creating ${this.receivers.length} HomeKit accessories.`);
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.receivers);
      } else {
        console.log('Tick');
        timeElapsed += checkCyclePeriod;
        timer = setTimeout(timeoutFunction, checkCyclePeriod);
      }
    };

    timer = setTimeout(timeoutFunction, checkCyclePeriod);

    this.statusTimer = setInterval(async () => { 
      this.log('Checking status', this.receivers.length);
      for (const receiver of this.receivers) {
        if (receiver.context.updateStatus?.length)
          for (const updateStatus of receiver.context.updateStatus) {
            await updateStatus();
          }
      }
     }, 10000);
  };

  configureAccessory(accessory) {
    this.log(`Configuring accessory: ${accessory.displayName}`);
    this.accessories.push(accessory);
  }

  setupFromService = async (service) => {
    this.log('Taking a look at:', service.name, service.addresses);

    const ipv4Address = service.addresses?.find(ip.isV4Format);
    if (ipv4Address) {
      service.host = ipv4Address;
    }

    if (service.port !== 80) return; // yamaha-nodejs only supports port 80

    const yamaha = new Yamaha(service.host);
    const cachedYamaha = new CachedYamaha(yamaha, { stdTTL: 30, checkperiod: 60 }); // Cache wrapper
    const yamahaProxy = cachedYamaha.createProxy(); // Cached proxy for API calls

    try {
      const systemConfig = await yamahaProxy.getSystemConfig().catch(e => { e; return null; });
      if (systemConfig?.YAMAHA_AV) {
        await this.createReceiver(service.name, yamahaProxy, systemConfig);
      } else {
        this.log.warn(`Failed to fetch system config for ${service.name}. Not a Yamaha AVR.`);
      }
    } catch (error) {
      this.log.error(`Error getting system config for ${service.name}:`, error);
    }
  };

  createReceiver = async (name, yamaha, sysConfig) => {
    const sysModel = sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0];
    const sysId = sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0];

    if (sysIds[sysId]) {
      this.log(`Duplicate system ID ${sysId} detected. Skipping.`);
      return;
    }
    sysIds[sysId] = true;
    this.receiverCount++;

    this.log(`Found Yamaha ${sysModel} (${sysId}): "${name}"`);

    if (this.nozones) {
      const accessory = new YamahaAVRAccessory(this, name, yamaha, sysConfig);
      this.receivers.push(accessory);
    }

    if (this.inputAccessories[name]) {
      Object.entries(this.inputAccessories[name]).forEach(([key, inputConfig]) => {
        const inputNumber = parseInt(key);
        const accName = inputConfig.name;
        this.log(`Creating accessory "${accName}" for input ${inputNumber}`);
        const accessory = new YamahaInputService({ log: this.log, config: inputConfig, api: this.api }, accName, yamaha, sysConfig, inputNumber);
        if (!this.accessories.find(accessory => accessory.UUID === accessory.UUID)) {
          this.receivers.push(accessory);
        } else {
          this.log.warn(`Input ${accName} already exists`);
        }
      });
    }

    if (this.partySwitch === 'yes') {
      const accessory = new YamahaParty(this, name, yamaha, sysConfig);
      this.receivers.push(accessory);
    }

    if (this.spotifyControls) {
      const accessory = new YamahaSpotify(this, name, yamaha, sysConfig);
      this.receivers.push(accessory);
    }

    const zones = await yamaha.getAvailableZones();
    for (const zone of zones) {
      const basicInfo = await yamaha.getBasicInfo(zone);
      if (basicInfo.getVolume() !== -999) {
        const zoneName = (await yamaha.getZoneConfig(zone))?.YAMAHA_AV?.[zone][0]?.Config[0]?.Name[0]?.Zone[0] || 'Main_Zone';
        if (!this.zoneControllersOnlyFor || this.zoneControllersOnlyFor.includes(zoneName)) {
          this.log.info(`Creating zone controller for ${zoneName}`);
          const zoneAccessory = new YamahaZone(this, zoneName, yamaha, sysConfig, zone);
          if (!this.accessories.find(accessory => accessory.UUID === zoneAccessory.UUID)) {
            this.receivers.push(zoneAccessory);
          } else {
            this.log.warn(`Zone controller for ${zoneName} already exists`);
          }
        }
      }
    }

    if (this.radioPresets) {
      const presets = await yamaha.getTunerPresetList();
      for (var preset in presets) {
        this.log("Adding preset %s - %s", preset, presets[preset].value, this.presetNum);
        var yamahaSwitch;
        if (!this.presetNum) {
          // preset by frequency
          yamahaSwitch = new YamahaSwitch(this, presets[preset].value, yamaha, sysConfig, preset);
        } else {
          // Preset by number
          yamahaSwitch = new YamahaSwitch(this, preset, yamaha, sysConfig, preset);
        }
        if (!this.accessories.find(accessory => accessory.UUID === yamahaSwitch.UUID)) {
          this.receivers.push(yamahaSwitch);
        } else {
          this.log.warn(`Zone controller for ${presets[preset].value} already exists`);
        }
      }
    }
  };
}
