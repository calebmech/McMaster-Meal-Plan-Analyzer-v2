function elapsedDays(startDate, endDate) {
  timeElapsed = endDate - startDate;
  daysElapsed = timeElapsed / 1000 / 3600 / 24;
  return daysElapsed;
}

var vm = new Vue({
  el: "#app",
  data: {
    prcntWeekendsAway:
      parseInt(localStorage.getItem("prcntWeekendsAway")) || 10,
    readingWeekAwayF:
      JSON.parse(localStorage.getItem("readingWeekAwayF")) || true,
    readingWeekAwayW:
      JSON.parse(localStorage.getItem("readingWeekAwayW")) || true,
    numIndvDaysAway: parseInt(localStorage.getItem("numIndvDaysAway")) || 0,
    lastExamDayF: parseInt(localStorage.getItem("lastExamDayF")) || 21,
    lastExamDayW: parseInt(localStorage.getItem("lastExamDayW")) || 26,
    numWeekendsAway: 0,
    payingDays: 0,
    moreOptions: false,
    studentNumber: localStorage.getItem("studentNumber") || null,
    accountPin: localStorage.getItem("accountPin") || null,
    trns: null,
    loadingData: false,
    fetchError: "",
    accountSetup: [],
    isOnline: navigator.onLine
  },
  methods: {
    fetchData: function() {
      this.loadingData = true;
      console.log("Getting transaction history....");
      fetch("../api", {
        method: "POST",
        headers: new Headers({
          "Content-Type": "application/json",
          Accept: "application/json"
        }),
        body: JSON.stringify({
          studentNumber: this.studentNumber,
          accountPin: this.accountPin
        })
      })
        .then(resp => resp.text())
        .then(resp => {
          try {
            this.fetchError = "";
            return JSON.parse(resp);
          } catch(err) {
            this.fetchError = resp;
            this.loadingData = false;
            return Promise.reject();
          }
        })
        .then(data => {
          console.log("Transaction history acquired!");
          this.loadingData = false;
          this.trns = [];
          this.accountSetup = [];
          for (i = 0; i < data.length; i++) {
            if (data[i].terminal == "FABO MANAGER") {
              this.accountSetup.push(data[i]);
            } else {
              this.trns = data.slice(i);

              return true;
            }
          }
        })
        .catch(err => console.log(err));
    },
    clearData: function() {
      (this.trns = null),
        (this.accountSetup = []),
        (this.studentNumber = null),
        (this.accountPin = null),
        (this.prcntWeekendsAway = 10),
        (this.readingWeekAwayF = true),
        (this.readingWeekAwayW = true),
        (this.numIndvDaysAway = 0),
        (this.lastExamDayF = 21),
        (this.lastExamDayW = 26);
    },
    updateConnectionStatus: function() {
      this.isOnline = navigator.onLine;
      console.log("Updated from vue");
    }
  },
  computed: {
    initialBalance: function() {
      var trns = this.accountSetup;

      var initialBalance = 0;

      for (i = 0; i < trns.length; i++) {
        account = trns[i].account;
        amount = trns[i].amount;

        if (account == 1 || account == 2) {
          if (amount[0] == "-") {
            initialBalance -= parseFloat(amount.slice(2));
          } else {
            initialBalance += parseFloat(amount.slice(1));
          }
        } else if (account == 5) {
          initialBalance += parseFloat(amount.slice(1) / 2);
        }
      }

      initialBalance = initialBalance * 2;

      return initialBalance.toFixed(2);
    },
    totalSpent: function() {
      var totalSpent = 0;
      this.trns.forEach(function(transaction) {
        if (transaction.account == 1 || transaction.account == 2) {
          totalSpent += parseFloat(transaction.amount.slice(2) * 2);
        } else if (transaction.account == 5) {
          totalSpent += parseFloat(transaction.amount.slice(2));
        }
      });
      totalSpent = totalSpent.toFixed(2);
      return totalSpent;
    },
    avgSpent: function() {
      var stmntStartDate = Date.parse(this.trns[0].date);
      var stmntEndDate = new Date();

      var stmntLength = Math.floor(elapsedDays(stmntStartDate, stmntEndDate));

      // Calculate Average Spent per Day

      var avgSpent = this.totalSpent / stmntLength;
      var avgSpent = avgSpent.toFixed(2);
      return avgSpent;
    },
    totalDays: function() {
      var firstTrnsDate = this.trns[0].date;
      var startDateF = new Date(
        firstTrnsDate.substring(6, 10),
        firstTrnsDate.substring(0, 2) - 1,
        firstTrnsDate.substring(3, 5)
      ).getTime();
      var _lastExamDayF = this.lastExamDayF === "" ? 21 : this.lastExamDayF;
      var endDateF = new Date(2017, 11, _lastExamDayF).getTime();
      var _lastExamDayW = this.lastExamDayW === "" ? 26 : this.lastExamDayW;
      var startDateW = new Date(2018, 01, 04).getTime();
      var endDateW = new Date(2018, 04, _lastExamDayW).getTime();

      var totalDays =
        elapsedDays(startDateF, endDateF) + elapsedDays(startDateW, endDateW);

      return totalDays;
    },
    allowedSpending: function() {
      var numWeeksTotal = Math.floor(this.totalDays / 7);
      this.numWeekendsAway = numWeeksTotal * this.prcntWeekendsAway / 100;
      var _numIndvDaysAway =
        this.numIndvDaysAway == "" ? 0 : this.numIndvDaysAway;
      var numDaysAway =
        this.numWeekendsAway * 2 +
        parseInt(_numIndvDaysAway) +
        this.readingWeekAwayF * 9 +
        this.readingWeekAwayW * 9;
      this.payingDays = this.totalDays - numDaysAway;
      var allowedSpending = this.initialBalance / this.payingDays;

      return allowedSpending.toFixed(2);
    },
    spendingColor: function() {
      spendingColor = "black";
      if (this.costPerDay < this.allowedSpending * 0.95) {
        spendingColor = "green";
      } else if (this.costPerDay > this.allowedSpending) {
        spendingColor = "red";
      } else {
        spendingColor = "orange";
      }
      return spendingColor;
    },
    remainingAmountAvg: function() {
      var remainingAmountAvg =
        this.initialBalance - this.costPerDay * this.payingDays;
      return remainingAmountAvg.toFixed(2);
    },
    activeDays: function() {
      var activeDays = 1;
      var previousDate = this.trns[0].date;

      for (i = 0; i < this.trns.length; i++) {
        if (this.trns[i].date != previousDate) {
          var previousDate = this.trns[i].date;
          activeDays++;
        }
      }
      return activeDays;
    },
    costPerDay: function() {
      var costPerDay = this.totalSpent / this.activeDays;
      return costPerDay.toFixed(2);
    },
    amountRemaining: function() {
      var amountRemaining = this.initialBalance - this.totalSpent;
      return amountRemaining.toFixed(2);
    },
    pastWeekAmount: function() {
      var daysElapsed = 0;
      var numTrns = this.trns.length - 1;
      var i = 0;
      var today = new Date();
      var weekAgoTrns = 0;
      var weekAmount = 0;
      while (daysElapsed < 7) {
        transaction = this.trns[numTrns - i];
        daysElapsed = elapsedDays(Date.parse(transaction.date), today);
        if (transaction.amount[0] === "-" && daysElapsed < 7) {
          if (transaction.account == 1 || transaction.account == 2) {
            weekAmount += parseFloat(transaction.amount.slice(2) * 2);
          } else if (transaction.account == 5) {
            weekAmount += parseFloat(transaction.amount.slice(2));
          }
        }
        i++;
      }
      return weekAmount.toFixed(2);
    }
  },
  watch: {
    studentNumber: function(val) {
      localStorage.setItem("studentNumber", val);
    },
    accountPin: function(val) {
      localStorage.setItem("accountPin", val);
    },
    prcntWeekendsAway: function(val) {
      localStorage.setItem("prcntWeekendsAway", val);
    },
    readingWeekAwayF: function(val) {
      localStorage.setItem("readingWeekAwayF", val);
    },
    readingWeekAwayW: function(val) {
      localStorage.setItem("readingWeekAwayW", val);
    },
    numIndvDaysAway: function(val) {
      localStorage.setItem("numIndvDaysAway", val);
    },
    lastExamDayF: function(val) {
      localStorage.setItem("lastExamDayF", val);
    },
    lastExamDayW: function(val) {
      localStorage.setItem("lastExamDayW", val);
    }
  }
});

window.addEventListener("online", vm.updateConnectionStatus);
window.addEventListener("offline", vm.updateConnectionStatus);
