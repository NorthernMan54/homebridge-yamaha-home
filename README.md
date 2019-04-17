# Homebridge-Yamaha-TV

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-yamaha-tv.svg?style=flat)](https://npmjs.org/package/homebridge-yamaha-tv)


Homebridge plugin for multi-zone Yamaha Receivers like the RX-V1075 that creates a HomeKit TV Icon to control the receiver. 

# Installation

Follow the instruction in [NPM](https://www.npmjs.com/package/homebridge) for the homebridge server installation. The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-yamaha) and should be installed "globally" by typing:

```
sudo npm install -g homebridge-yamaha-home
```

# Configuration

## config.json

- play_volume - Sets volume to this when turning on, defaults to -48
- min_volume -
- max_volume -
- setMainInputTo - Sets input to this when turning on, no default.
- show_input_name - Creates a button to display which input is selected, defaults to no
- manual_addresses - Only required if Bonjour/Autodetection doesn't work.
- expected_devices - Maximum number of accessories created, defaults to 100
- discovery_timeout - How long to stay in discovery mode, defaults to 30
- radio_presets - Create a switch for each radio preset, defaults to false ( true/false )
- preset_num - Names the switch the number of the preset, defaults to false ( true/false ). Otherwise the name is the frequency. ( useful with Siri and Alexa )
- zone - Zone name
- zone_controllers_only_for - A list of zone names for which an accessory is to be created. If no value for this key is provided, then accessories for all available zones are created.

Optional Properties:
- party_switch - You can choose whether you need Party Mode Switch or not. "party_switch": "yes" if needed or don't add this property if you don't need the switch.
- inputs_as_accessories - If property exists, Input or Scene switch will be created. Checkout a config for an example.
- YamahaReceiver - Here should be your yamaha recevier network name. Additional switches won't work with a wrong receiver name.
- set_scene –  If property exists, Scene switch will be created. Checkout a config for example.
- setInputTo - use this property to specify input for switch. Also, add this property if you want a scene switch (use the same input name as in your receiver scene settings).
- spotify - Enable spotify control buttons
- nozones - Do not create an accessory per zone

## Basic config.json config

"platforms": [{
  "platform": "yamaha-home",
  "max_volume": 10
}

## Example advanced configuration

Example config.json:
```json
{
    "bridge": {
        "name": "Homebridge",
        "username": "CC:22:3D:E3:CE:51",
        "port": 51826,
        "pin": "031-45-154"
    },
    "description": "This is an example configuration file for homebridge plugin for yamaha AVR",
    "hint": "Always paste into jsonlint.com validation page before starting your homebridge, saves a lot of frustration",

  "platforms": [
    {
      "platform": "yamaha-home",
      "play_volume": -48,
      "setMainInputTo": "Airplay",
      "show_input_name": "yes",
      "party_switch": "yes",
      "inputs_as_accessories":{
        "YamahaReceiver": {
          "1": {
                "name":"Raspberry",
                "setInputTo": "HDMI1",
                "set_default_volume": -49
           },
          "2": {
                "name":"AppleTV",
                "setInputTo": "HDMI2"
           },
           "3": {
                "name": "Scene 3",
                "set_scene": "3",
                "setInputTo": "HDMI3"
          }
        }
      },
      "manual_addresses": {
          "Yamaha": "192.168.1.115"
      }
    }
  ],
  "accessories": [
      {}
    ]
}
```

# Credits

* neonightmare - Creating the original plugin
* TommyCardello - Adding Party Mode Switch, Adding Input or Scene Switches.
