/**
 * cPanel / Phusion Passenger / Shared Hosting default entry point.
 * Point cPanel "Setup Node.js App" -> Application startup file to: app.js
 */
module.exports = require('./dist/server.js');
