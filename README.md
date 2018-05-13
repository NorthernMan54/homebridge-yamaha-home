# Homebridge-Yamaha-Home

[![NPM Downloads](https://img.shields.io/npm/dm/homebridge-yamaha-home.svg?style=flat)](https://npmjs.org/package/homebridge-yamaha-home)


homebridge-plugin for Yamaha AVR control with Apple-Homekit.  Optimized for use with the Apple Home App and with homebridge-alexa

# Installation

Follow the instruction in [NPM](https://www.npmjs.com/package/homebridge) for the homebridge server installation. The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-yamaha) and should be installed "globally" by typing:

```
sudo npm install -g homebridge-yamaha-home
```

# Configuration

config.json

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
- party_switch - You can choose whether you need Party Mode Switch or not. "party_switch": "yes" if needed or don't add this property if you don't need the switch.

Example:

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
            "manual_addresses": {
                "Yamaha": "192.168.1.115"
            }
        }
    ],
    "accessories": [
        {},
        {}
    ]
    }
```
