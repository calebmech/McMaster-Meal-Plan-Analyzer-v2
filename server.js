var express = require('express');
var bodyParser = require("body-parser");
var request = require('request');
var cheerio = require('cheerio');
var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var j = request.jar()
var request = request.defaults({jar: j})

var loginPage = "https://mealacct.mcmaster.ca/OneWeb/Account/LogOn"
var transactionPage = "https://mealacct.mcmaster.ca/OneWeb/Financial/TransactionsPass?dateFrom=2016%2F01%2F13+00%3A00%3A00&dateTo=2018%2F02%2F13+23%3A59%3A59&returnRows=1000&_=" + Date.now()

app.post('/api', (req, res) => {

    var studentNumber = req.body.studentNumber;
    var accountPin = req.body.accountPin;

    function sendResults(data) {
        res.send(data);
    }

    request({url: loginPage}, (err, res, html) => {

        var $ = cheerio.load(html);
        var token = $('[name=__RequestVerificationToken]').val();
        var params = { "__RequestVerificationToken": token, "Account": studentNumber, "Password": accountPin };
        console.log("Request Token Acquired")
        
        request.post({url: loginPage, form:params}, (err, res, html) => {
            console.log("Logged in")

            request({ url: transactionPage} , (err, res, html) => {
                console.log("Data downloaded")
                var trns = []
                var $ = cheerio.load(html);

                $('table.table > tbody > tr').each(function(i, elem) {

                    var dateTime = $(this).children('td[data-title="Date:"]').html()
                    var date = dateTime.match(/\d{2}\/\d{2}\/\d{4}/g)[0];
                    var time = dateTime.match(/\d{1,2}:\d{2}:\d{2} (?:PM|AM)/g)[0];

                    trns[i] = { 
                        'date': date,
                        'time': time,
                        'amount': $(this).children('td[data-title="Amount:"]').html().replace(',',''),
                        'account': parseInt($(this).children('td[data-title="Balance:"]').html()),
                        'desposit': parseInt($(this).children('td[data-title="Units:"]').html()),
                        'trantype': $(this).children('td[data-title="Trantype:"]').html().trim(),
                        'terminal': $(this).children('td[data-title="Terminal:"]').html().trim().slice(8), // Fix this hack with regex
                    }
              });

              trns.reverse();

              console.log("Data processed")              
              sendResults(trns);

            });
        });
    });

});

app.use(express.static('app'))

app.listen('8080')
console.log('Magic happens on port 8080');
exports = module.exports = app;