const express = require("express");
let rp = require("request-promise");
const bodyParser = require("body-parser");
const cheerio = require("cheerio");
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("app"));

// Setup Cookie Jar
let jar = rp.jar();
rp = rp.defaults({ jar: jar });

// Setup Request Options
const loginPage = "https://mealacct.mcmaster.ca/OneWeb/Account/LogOn";
const transactionPage =
  "https://mealacct.mcmaster.ca/OneWeb/Financial/TransactionsPass?dateFrom=2016%2F01%2F13+00%3A00%3A00&dateTo=2018%2F02%2F13+23%3A59%3A59&returnRows=1000&_=" +
  Date.now();

// Handle API Call
app.post("/api", (req, res) => {
  // Clear cookie jar on each request
  jar = rp.jar();

  let token = 0;
  let studentNumber = req.body.studentNumber;
  let accountPin = req.body.accountPin;

  const getTokenOptions = {
    uri: loginPage,
    transform: body => {
      return cheerio.load(body);
    }
  };

  function sendResults(data) {
    res.send(data);
  }

  // Acquire Login Token
  rp(getTokenOptions)
    .then($ => {
      token = $("[name=__RequestVerificationToken]").val();
      params = {
        __RequestVerificationToken: token,
        Account: studentNumber,
        Password: accountPin
      };
      console.log("Request Token Acquired");

      const loginOptions = {
        method: "POST",
        uri: loginPage,
        form: params
      };

      // Login to Payment System
      rp(loginOptions)
        // Returns 200 if login is bad
        .then(res => {
          console.log("Incorrect student number / pin");
        })
        .catch((res, err) => {
          if (res.statusCode == 302) {
            console.log("Logged in");

            const scrapeOptions = {
              uri: transactionPage,
              transform: body => {
                return cheerio.load(body);
              }
            };

            // Scrape Transaction History
            rp(scrapeOptions).then($ => {
              let trns = [];

              $("table.table > tbody > tr").each((i, elem) => {
                let dateTime = $(elem)
                  .children('td[data-title="Date:"]')
                  .html();
                let date = dateTime.match(/\d{2}\/\d{2}\/\d{4}/g)[0];
                let time = dateTime.match(/\d{1,2}:\d{2}:\d{2} (?:PM|AM)/g)[0];

                trns[i] = {
                  date: date,
                  time: time,
                  amount: $(elem)
                    .children('td[data-title="Amount:"]')
                    .html()
                    .replace(",", ""),
                  account: parseInt(
                    $(elem)
                      .children('td[data-title="Balance:"]')
                      .html()
                  ),
                  desposit: parseInt(
                    $(elem)
                      .children('td[data-title="Units:"]')
                      .html()
                  ),
                  trantype: $(elem)
                    .children('td[data-title="Trantype:"]')
                    .html()
                    .trim(),
                  terminal: $(elem)
                    .children('td[data-title="Terminal:"]')
                    .html()
                    .trim()
                    .slice(8) // Fix this hack with regex
                };
              });

              trns.reverse();

              console.log("Data processed");
              sendResults(trns);
            });
          } else {
            console.error("Error logging in:\n", res.statusCode);
          }
        });
    })
    .catch(err => {
      return console.error(err);
    });
});

const port = process.env.PORT || 3000;
app.listen(port);

console.log("Magic happens on port", port);
