// get an instance of mongoose and mongoose.Schema
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// set up a mongoose model and pass it using module.exports
module.exports = mongoose.model('File', new Schema({ 
    user: String,
    filename: String, 
    filetype: String,
    size: String, 
    date: Date, 
    tags: String,
    location: String
}));