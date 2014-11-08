var express = require('express');
var router = express.Router();

var serialport = require("serialport");
var SerialPort = serialport.SerialPort;

var sp = new SerialPort("/dev/ttyACM0",{
  parser: serialport.parsers.readline('\n'),
  baudrate: 9600 
});

var accountSid = 'ACb3eae686356a067a269db8f45191ce94';
var authToken = "1f3d7db2a4f673e4bd621e0901c24d53";
var client = require('/usr/lib/node_modules/twilio/lib')(accountSid, authToken);

var title = " "

var HIST_SEC = 20 //seconds of previous data to store
var DATA_RATE = 2 //points per second

yellow_zone = 1.1
red_zone = 1.3


function hexToInt(val,index,array){
	return parseInt(val,16)
}
function intToAscii(val,index,array) {
	return String.fromCharCode(val)
}
function LineFitter()
{
    this.count = 0;
    this.sumX = 0;
    this.sumX2 = 0;
    this.sumXY = 0;
    this.sumY = 0;
}

LineFitter.prototype = {
    'add': function(x, y)
    {
        this.count++;
        this.sumX += x;
        this.sumX2 += x*x;
        this.sumXY += x*y;
        this.sumY += y;
    },
    'line': function(){
        var det = this.count * this.sumX2 - this.sumX * this.sumX;
        var offset = (this.sumX2 * this.sumY - this.sumX * this.sumXY) / det;
        var scale = (this.count * this.sumXY - this.sumX * this.sumY) / det;
        return {"m":scale,"b":offset};
    },
    'project': function(x){
    	line = self.line();
    	return line.m * x + line.b;
    }
};

function fitLine(data)
{
    var fitter = new LineFitter();
    for (var i = 0; i < data.length; i++)
    {
        fitter.add(i, data[i]);
    }
    return fitter
}

var pressures = new Array();
var temperatures = new Array();

var state = "cal"; //"cal","green","yellow","red"
var baseline = 0;
function process(data){
	var s = data.split(' ').slice(0,data.split(' ').length-1).map(hexToInt).map(intToAscii).join('');
    console.log(s)
    if(s == "reset"){
    	console.log("Reset!")
    	pressures = new Array();
		temperatures = new Array();
    	state = "cal"
    }else{
    	var split = s.split(';')
    	p = parseInt(split[0])
    	pressures.push(p)
    	if(pressures.length > HIST_SEC * DATA_RATE){
    		pressures.shift()
    	}
    	//console.log(pressures)

    	t = parseInt(split[1])
    	//console.log(t)
    	temperatures.push(t)
    	if(temperatures.length > HIST_SEC * DATA_RATE){
    		temperatures.shift()
    	}
    	//console.log(temperatures)

    	if(state == "cal" && pressures.length >= HIST_SEC * DATA_RATE){
    		var sum = pressures.reduce(function(a, b) { return a + b });
			baseline = sum / pressures.length;
			console.log(baseline);
			state = "green"
    	}else if(state != "cal"){
    		trend = fitLine(pressures);
    		//console.log(trend.line().m)
    		if (p < yellow_zone * baseline && state != "green"){
    			state = "green"
    			console.log(state)
    		}else if(p >= yellow_zone * baseline && p < red_zone *baseline && state != "yellow"){
    			state = "yellow"
    			console.log(state)
    		}else if(p >= red_zone * baseline && state != "red"){
    			//send text
    			state = "red"
    			console.log(state)
    		}
    	}
    	


    }
}

sp.on('open',function(){
    console.log("Serial Open");
    sp.on('data', process);
});

var s = '{"P":123,"T":123.34}'
try{
	var data = JSON.parse(s)
}catch(e){
	console.log(e)
}

console.log(data.P,data.T)

/*client.messages.create({
    body: "You're beginning to swell! Go to ___ for assistance.",
    to: "+16508148524",
    from: "+15207771868"
}, function(err, message) {
    process.stdout.write(message.sid);
});*/


/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: title });
});

module.exports = router;
