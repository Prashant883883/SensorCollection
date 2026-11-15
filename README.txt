Sensor on/off update

Replace these three files in your GitHub repository:
- index.html
- app.js
- style.css

The control panel now shows a separate "Disable smartphone sensors" button while sensors are enabled.
Clicking it removes this page's deviceorientation and devicemotion event listeners, clears the displayed readings, resets the calibration reference, and returns the control to "Enable smartphone sensors".

Note: This stops this webpage from receiving/processing sensor events. It does not switch off the iPhone's physical sensors or revoke the browser's site permission.
