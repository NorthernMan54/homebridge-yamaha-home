# Homebridge-Yamaha

homebridge-plugin for Yamaha AVR control with Apple-Homekit.

# Installation

Follow the instruction in [NPM](https://www.npmjs.com/package/homebridge) for the homebridge server installation. The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-yamaha) and should be installed "globally" by typing:

```
sudo npm install -g homebridge-yamaha
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
- preset_name - Names the switch the frequency of the preset, defaults to true ( true/false ). Otherwise the name is the preset number.
- zone - Zone name

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
            "platform": "YamahaAVR",
            "play_volume": -48,
            "setMainInputTo": "Airplay",
            "show_input_name": "yes",
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
