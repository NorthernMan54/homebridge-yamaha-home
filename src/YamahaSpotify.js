const debug = require('debug')('yamaha-Spotify');
const { Service, Characteristic } = require('hap-nodejs'); // Ensure these are imported based on your environment

class YamahaSpotify {
  constructor(log, config, name, yamaha, sysConfig) {
    this.log = log;
    this.config = config;
    this.yamaha = yamaha;
    this.sysConfig = sysConfig;

    this.nameSuffix = config["name_suffix"] || " Party Mode";
    this.zone = config["zone"] || 1;
    this.name = `Spotify (${name})`;
    this.serviceName = name;
    this.setMainInputTo = config["setMainInputTo"];
    this.playVolume = this.config["play_volume"];
    this.minVolume = config["min_volume"] || -65.0;
    this.maxVolume = config["max_volume"] || -10.0;
    this.gapVolume = this.maxVolume - this.minVolume;
    this.showInputName = config["show_input_name"] || "no";

    this.log(`Adding Spotify button ${this.name}`);
  }

  getServices() {
    const services = [];
    const informationService = new Service.AccessoryInformation();

    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, "yamaha-home")
      .setCharacteristic(
        Characteristic.Model,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].Model_Name[0]
      )
      .setCharacteristic(
        Characteristic.FirmwareRevision,
        require('../package.json').version
      )
      .setCharacteristic(
        Characteristic.SerialNumber,
        this.sysConfig.YAMAHA_AV.System[0].Config[0].System_ID[0]
      );

    services.push(informationService);

    ["Play", "Pause", "Skip Fwd", "Skip Rev"].forEach((button) => {
      const spotifyButton = new Service.Switch(`${button} (${this.serviceName})`);
      spotifyButton.subtype = button;

      debug("Adding Spotify Button", spotifyButton.displayName);

      spotifyButton
        .getCharacteristic(Characteristic.On)
        .on('set', async (on, callback) => {
          try {
            debug("Spotify Control", spotifyButton.displayName);
            if (on) {
              // Send the command to Yamaha receiver
              await this.yamaha.SendXMLToReceiver(
                `<YAMAHA_AV cmd="PUT"><Spotify><Play_Control><Playback>${spotifyButton.subtype}</Playback></Play_Control></Spotify></YAMAHA_AV>`
              );

              // Reset the button state after 5 seconds
              setTimeout(() => {
                spotifyButton.setCharacteristic(Characteristic.On, 0);
              }, 5 * 1000);
            }
            callback(null);
          } catch (error) {
            debug("Error in Spotify button:", error);
            callback(error);
          }
        });

      services.push(spotifyButton);
    });

    return services;
  }
}

module.exports = YamahaSpotify;
