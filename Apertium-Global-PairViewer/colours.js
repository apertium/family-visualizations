var TRUNK_COLOR = "#5dff0b";
var STAGING_COLOR = "#ffd900";
var NURSERY_COLOR = "#ff5900";
var INCUBATOR_COLOR = "#cc0000";
var UNKNOWN_COLOR = "#9c27b0";

var countryColor = d3
  .scaleThreshold()
  .domain([
    0,
    100,
    200,
    300,
    400,
    500,
    600,
    700,
    800,
    900,
    1000
  ])
  .range([
    "#55b380",
    "#4da673",
    "#449966",
    "#3b8c59",
    "#33804d",
    "#2b7340",
    "#226633",
    "#1a5926",
    "#114d1a",
    "#08400d",
    "#003300",
  ]);

/********* colorbrewing *********/
var maxStems = 100000;
// Forbid the 0-9 category (-1)
var numShades = parseInt(Math.log(maxStems) / Math.LN10) - 1;
var translationClasses = ["trunk", "staging", "nursery", "incubator"];
var goldenYellowScale = {
  4: ["#ffd54c", "#ffc300", "#CC9C00", "#7f6a26"],
  5: ["#FFF199", "#FFEC70", "#E0C200", "#CCB100", "#B89F00"],
  6: ["#FFEC70", "#FFE433", "#E0C200", "#CCB100", "#B89F00", "#A38D00"]
};
var translationClassColourChoices = [
  [colorbrewer.BuGn, colorbrewer.Blues, colorbrewer.YlOrRd, colorbrewer.Greys],
  [colorbrewer.BuGn, colorbrewer.GnBu, colorbrewer.YlOrBr, colorbrewer.PuRd],
  [colorbrewer.YlGn, colorbrewer.Blues, colorbrewer.PuRd, colorbrewer.Greys],
  [colorbrewer.YlGn, colorbrewer.Blues, colorbrewer.PuRd, colorbrewer.OrRd],
  [colorbrewer.YlGn, colorbrewer.YlGnBu, colorbrewer.Oranges, colorbrewer.Reds],
  [colorbrewer.YlGn, goldenYellowScale, colorbrewer.Oranges, colorbrewer.Reds]
];
// Vary only lightness.
var niceGreen = d3.rgb("#0c0"),
  niceYellow = d3.rgb("#fc0"),
  niceOrange = d3.rgb("#f60"),
  niceRed = d3.rgb("#c00");
var temp = [];
[niceGreen, niceYellow, niceOrange, niceRed].forEach(function(c) {
  var tempp = [];
  for (i = 0; i < 5; ++i) {
    tempp.push(c.darker(i - 1));
  }
  temp.push({ 5: tempp.reverse() });
});
translationClassColourChoices.push(temp);
// Desaturate
// Actually this has become so complex. A colour theory specialist needs to analyse this.
var temp = [];
[
  d3.hsl(100, 1, 0.5),
  d3.hsl(51, 1, 0.5),
  d3.hsl(21, 1, 0.5),
  d3.hsl(0, 1, 0.4)
].forEach(function(c) {
  var tempp = [];
  for (i = 0; i < 5; ++i) {
    var cc = c.brighter(0);
    if (cc.h == 0) {
      cc.s = cc.s / (i + 0.5);
      cc.l = cc.l + 0.3 * Math.sqrt(i);
    } else if (cc.h == 100) {
      cc.s = cc.s / (2 * i + 1);
      cc.l = cc.l + 0.01 * Math.exp(i + 0.8);
    } else {
      cc.s = cc.s / (i + 0.5);
      cc.l *= Math.pow(1.22, i);
    }
    tempp.push(cc);
  }
  temp.push({ 5: tempp.reverse() });
});
translationClassColourChoices.push(temp);
var translationClassColours = translationClassColourChoices[7].map(function(e) {
  return e[numShades + 1].slice(1);
});
/********* end of colorbrewing *********/
