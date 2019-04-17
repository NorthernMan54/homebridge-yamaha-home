// Constants

/*
Characteristic.InputSourceType.OTHER = 0;
Characteristic.InputSourceType.HOME_SCREEN = 1;
Characteristic.InputSourceType.TUNER = 2;
Characteristic.InputSourceType.HDMI = 3;
Characteristic.InputSourceType.COMPOSITE_VIDEO = 4;
Characteristic.InputSourceType.S_VIDEO = 5;
Characteristic.InputSourceType.COMPONENT_VIDEO = 6;
Characteristic.InputSourceType.DVI = 7;
Characteristic.InputSourceType.AIRPLAY = 8;
Characteristic.InputSourceType.USB = 9;
Characteristic.InputSourceType.APPLICATION = 10;
*/

/*
// The value property of InputDeviceType must be one of the following:
Characteristic.InputDeviceType.OTHER = 0;
Characteristic.InputDeviceType.TV = 1;
Characteristic.InputDeviceType.RECORDING = 2;
Characteristic.InputDeviceType.TUNER = 3;
Characteristic.InputDeviceType.PLAYBACK = 4;
Characteristic.InputDeviceType.AUDIO_SYSTEM = 5;
*/

// I copied this out of the WebUI for my Receiver

module.exports = {
  Inputs: [{
      ConfiguredName: "TUNER",
      Identifier: 0,
      InputDeviceType: 5,
      InputSourceType: 2
    },
    {
      ConfiguredName: "MULTI CH",
      Identifier: 1,
      InputDeviceType: 5,
      InputSourceType: 0
    },
    {
      ConfiguredName: "PHONO",
      Identifier: 2,
      InputDeviceType: 5,
      InputSourceType: 2
    },
    {
      ConfiguredName: "HDMI1",
      Identifier: 3,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "HDMI2",
      Identifier: 4,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "HDMI3",
      Identifier: 5,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "HDMI4",
      Identifier: 6,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "HDMI5",
      Identifier: 7,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "HDMI6",
      Identifier: 8,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "HDMI7",
      Identifier: 9,
      InputDeviceType: 5,
      InputSourceType: 3
    },
    {
      ConfiguredName: "AV1",
      Identifier: 10,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "AV2",
      Identifier: 11,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "AV3",
      Identifier: 12,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "AV4",
      Identifier: 13,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "AV5",
      Identifier: 14,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "AV6",
      Identifier: 15,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "AV7",
      Identifier: 16,
      InputDeviceType: 5,
      InputSourceType: 7
    },
    {
      ConfiguredName: "V-AUX",
      Identifier: 17,
      InputDeviceType: 5,
      InputSourceType: 4
    },
    {
      ConfiguredName: "AUDIO1",
      Identifier: 18,
      InputDeviceType: 0,
      InputSourceType: 3
    },
    {
      ConfiguredName: "AUDIO2",
      Identifier: 19,
      InputDeviceType: 1,
      InputSourceType: 3
    },
    {
      ConfiguredName: "AUDIO3",
      Identifier: 20,
      InputDeviceType: 2,
      InputSourceType: 3
    },
    {
      ConfiguredName: "AUDIO4",
      Identifier: 21,
      InputDeviceType: 3,
      InputSourceType: 3
    },
    {
      ConfiguredName: "USB/NET",
      Identifier: 22,
      InputDeviceType: 5,
      InputSourceType: 9
    },
    {
      ConfiguredName: "Rhapsody",
      Identifier: 23,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      ConfiguredName: "Napster",
      Identifier: 24,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      ConfiguredName: "SiriusXM",
      Identifier: 25,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      ConfiguredName: "Pandora",
      Identifier: 26,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      ConfiguredName: "Spotify",
      Identifier: 27,
      InputDeviceType: 4,
      InputSourceType: 10
    },
    {
      ConfiguredName: "AirPlay",
      Identifier: 28,
      InputDeviceType: 5,
      InputSourceType: 8
    },
    {
      ConfiguredName: "SERVER",
      Identifier: 29,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      ConfiguredName: "NET RADIO",
      Identifier: 30,
      InputDeviceType: 5,
      InputSourceType: 10
    },
    {
      ConfiguredName: "USB",
      Identifier: 31,
      InputDeviceType: 5,
      InputSourceType: 9
    },
    {
      ConfiguredName: "iPod (USB)",
      Identifier: 32,
      InputDeviceType: 5,
      InputSourceType: 0
    }
  ],
  mapKeyToControl: mapKeyToControl
};

var Characteristic = {};
Characteristic.RemoteKey = {};

// Copied from HomeKitType-Television

Characteristic.RemoteKey.REWIND = 0;
Characteristic.RemoteKey.FAST_FORWARD = 1;
Characteristic.RemoteKey.NEXT_TRACK = 2;
Characteristic.RemoteKey.PREVIOUS_TRACK = 3;
Characteristic.RemoteKey.ARROW_UP = 4;
Characteristic.RemoteKey.ARROW_DOWN = 5;
Characteristic.RemoteKey.ARROW_LEFT = 6;
Characteristic.RemoteKey.ARROW_RIGHT = 7;
Characteristic.RemoteKey.SELECT = 8;
Characteristic.RemoteKey.BACK = 9;
Characteristic.RemoteKey.EXIT = 10;
Characteristic.RemoteKey.PLAY_PAUSE = 11;
Characteristic.RemoteKey.INFORMATION = 15;

function mapKeyToControl(key) {
  var code;
  switch (key) {
    case Characteristic.RemoteKey.ARROW_RIGHT:
      code = "Skip Fwd";
      break;
    case Characteristic.RemoteKey.ARROW_LEFT:
      code = "Skip Rev";
      break;
    case Characteristic.RemoteKey.PLAY_PAUSE:
      code = "Pause";
      break;
    case Characteristic.RemoteKey.SELECT:
      code = "Play";
      break;
    case Characteristic.RemoteKey.BACK:
      code = "Stop";
      break;
  }
  return (code);
}
