// Apertium Global Pairviewer
// Colin Pillsbury, Spring 2017
// cpillsb1@swarthmore.edu

var fixedWidth = window.innerWidth,
  fixedHeight = window.innerHeight;

var width =
  window.innerWidth > window.innerHeight
    ? window.innerHeight
    : window.innerWidth;

var currentRepoFilter = [];
var currentPointFilter = [];
var currentDirFilter = [];

var visitMap = new Map();

var MARKER_SIZE = "40";

var proj = d3
  .geoOrthographic()
  .translate([fixedWidth / 2, fixedHeight / 2])
  .clipAngle(90)
  .scale(width / 4);

var sky = d3
  .geoOrthographic()
  .translate([fixedWidth / 2, fixedHeight / 2])
  .clipAngle(90)
  .scale(width / 3);

// Point radius can be updated here
var path = d3
  .geoPath()
  .projection(proj)
  .pointRadius(3);

var swoosh = d3
  .line()
  .x(d => d[0])
  .y(d => d[1])
  .curve(d3.curveCardinal.tension(-1.3));

var links = [],
  arcLines = [];

// Defining tooltip
var div = d3
  .select("body")
  .append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Table used to look up full language names
var codeToLangTable = {};
d3.json("languages.json", function(error, table) {
  codeToLangTable = jQuery.extend(true, {}, table);
});

// Currently not using long/lat lines, but can be used by uncommenting and pathing
// var graticule = d3.geo.graticule();

var svg = d3
  .select("body")
  .append("svg")
  .attr("width", fixedWidth)
  .attr("height", fixedHeight);
svg.style("background", "black");

window.addEventListener("resize", resize);

var zoom = d3
  .zoom()
  .scaleExtent([100, 50000])
  .on("start", zoomstart)
  .on("zoom", zoomed)
  .on("end", zoomend);

svg.call(zoom);

d3.select("svg").on("dblclick.zoom", null);

function resize() {
  fixedWidth = window.innerWidth;
  fixedHeight = window.innerHeight;
  svg.attr("width", fixedWidth).attr("height", fixedHeight);

  sky = d3
    .geoOrthographic()
    .translate([fixedWidth / 2, fixedHeight / 2])
    .clipAngle(90)
    .scale(width / 3);

  proj = d3
    .geoOrthographic()
    .translate([fixedWidth / 2, fixedHeight / 2])
    .clipAngle(90)
    .scale(width / 4);

  path = d3
    .geoPath()
    .projection(proj)
    .pointRadius(3);

  svg
    .select("#globe")
    .attr("cx", fixedWidth / 2)
    .attr("cy", fixedHeight / 2);

  if (o0) {
    proj.rotate(o0);
    sky.rotate(o0);
  }

  refresh();

  var sidenavHeight = $("#sidenav").css("height");
  var val = parseInt(sidenavHeight.substring(0, sidenavHeight.length - 2));
  var offset = 487;
  var total = val - offset >= 0 ? val - offset : 0;
  $("#pointList").css("max-height", total + "px");
}

let diversityById = {};
let toggled = true;
function toggleMapColour() {
  if (toggled) {
    svg
      .selectAll("path.land")
      .style("fill", "white")
      .style("stroke", "gray");

    svg.select(".labels").style("fill", "black");

    svg.select(".points").style("fill", "black");
  } else {
    svg
      .selectAll("path.land")
      .style("fill", d => countryColor(diversityById[d.id]))
      .style("stroke", "#001a00");

    svg.select(".labels").style("fill", "white");

    svg.select(".points").style("fill", "#e0e0e0");
  }
  toggled = !toggled;

  refresh();
}

var correctZoom = d3
  .scaleLinear()
  .domain([0, window.devicePixelRatio])
  .range([0, 1]);

var aFactor = Math.round((fixedWidth * fixedHeight) / 500000);

function drawStars() {
  var smallStars = [];
  for (var i = 0; i < aFactor * 100; i++) {
    smallStars.push({ x: randomX(), y: randomY() });
  }

  var mediumStars = [];
  for (var i = 0; i < aFactor * 10; i++) {
    mediumStars.push({ x: randomX(), y: randomY() });
  }

  var bigStars = [];
  for (var i = 0; i < aFactor; i++) {
    bigStars.push({ x: randomX(), y: randomY() });
  }

  svg
    .selectAll(".smallStar")
    .data(smallStars)
    .enter()
    .append("circle")
    .classed("smallStar", true)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", "1px")
    .style("fill", "#fff");

  svg
    .selectAll(".mediumStar")
    .data(mediumStars)
    .enter()
    .append("circle")
    .classed("mediumStar", true)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", "2px")
    .style("fill", "#fff");

  svg
    .selectAll(".bigStar")
    .data(bigStars)
    .enter()
    .append("circle")
    .classed("bigStar", true)
    .attr("cx", d => d.x)
    .attr("cy", d => d.y)
    .attr("r", "3px")
    .style("fill", "#fff");
}

function randomX() {
  return Math.round(Math.random() * window.innerWidth);
}

function randomY() {
  return Math.round(Math.random() * window.innerHeight);
}

queue()
  .defer(d3.json, "world-110m.json")
  .defer(d3.json, "apertiumPairs.json")
  .defer(d3.json, "apertiumPoints.json")
  .defer(d3.tsv, "linguistic_diversity.tsv")
  .await(ready);

function ready(error, world, places, points, diversity) {
  // grid = graticule(); currently lat lon lines not used, can uncomment to use

  drawStars();

  var ocean_fill = svg
    .append("defs")
    .append("radialGradient")
    .attr("id", "ocean_fill")
    .attr("cx", "75%")
    .attr("cy", "25%");
  ocean_fill
    .append("stop")
    .attr("offset", "5%")
    .attr("stop-color", "#82B1FF");
  ocean_fill
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#2196F3");

  var drop_shadow = svg
    .append("defs")
    .append("radialGradient")
    .attr("id", "drop_shadow")
    .attr("cx", "50%")
    .attr("cy", "50%");
  drop_shadow
    .append("stop")
    .attr("offset", "20%")
    .attr("stop-color", "#000")
    .attr("stop-opacity", ".5");
  drop_shadow
    .append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#000")
    .attr("stop-opacity", "0");

  var markerDef = svg.append("defs");
  markerDef
    .append("marker")
    .attr("id", "trunkoneway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", TRUNK_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M 1 1 L 3 2 L 1 3 Z");
  markerDef
    .append("marker")
    .attr("id", "trunktwoway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2.5")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", TRUNK_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M0 2 L 2 1 L 2 3 L 0 2 M 2.5 1 L 4.5 2 L 2.5 3 L 2.5 1");
  markerDef
    .append("marker")
    .attr("id", "stagingoneway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", STAGING_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M 1 1 L 3 2 L 1 3 Z");
  markerDef
    .append("marker")
    .attr("id", "stagingtwoway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2.5")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", STAGING_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M0 2 L 2 1 L 2 3 L 0 2 M 2.5 1 L 4.5 2 L 2.5 3 L 2.5 1");
  markerDef
    .append("marker")
    .attr("id", "nurseryoneway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", NURSERY_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M 1 1 L 3 2 L 1 3 Z");
  markerDef
    .append("marker")
    .attr("id", "nurserytwoway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2.5")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", NURSERY_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M0 2 L 2 1 L 2 3 L 0 2 M 2.5 1 L 4.5 2 L 2.5 3 L 2.5 1");
  markerDef
    .append("marker")
    .attr("id", "incubatoroneway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", INCUBATOR_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M 1 1 L 3 2 L 1 3 Z");
  markerDef
    .append("marker")
    .attr("id", "incubatortwoway")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", "2.5")
    .attr("refY", "2")
    .attr("markerUnits", "userSpaceOnUse")
    .attr("markerWidth", MARKER_SIZE)
    .attr("markerHeight", MARKER_SIZE)
    .attr("orient", "auto")
    .style("fill", INCUBATOR_COLOR)
    .style("stroke", "black")
    .style("stroke-width", "0.3px")
    .append("path")
    .attr("d", "M0 2 L 2 1 L 2 3 L 0 2 M 2.5 1 L 4.5 2 L 2.5 3 L 2.5 1");

  svg
    .append("circle")
    .attr("cx", fixedWidth / 2)
    .attr("cy", fixedHeight / 2)
    .attr("r", proj.scale())
    .attr("class", "noclicks")
    .attr("id", "globe")
    .style("fill", "url(#ocean_fill)");

  diversity.forEach(function(d) {
    diversityById[d.id] = d.diversity;
  });

  svg
    .append("g")
    .selectAll("path.land")
    .data(world.features)
    .enter()
    .append("path")
    .attr("class", "land")
    .attr("d", path)
    .style("fill", d => countryColor(diversityById[d.id]))
    .style("stroke", "#001a00")
    .style("stroke-width", 1)
    .style("opacity", 0.8);

  // LONG AND LAT LINES, need to uncomment other graticule references to use
  // svg.append("path")
  //       .datum(graticule)
  //       .attr("class", "graticule noclicks")
  //       .attr("d", path);

  // Parse default pairs
  places.pairs.forEach(function(a) {
    var s, t;
    for (var pointInd = 0; pointInd < points.point_data.length; pointInd++) {
      if (points.point_data[pointInd].tag === a.lg2) {
        s = points.point_data[pointInd].geometry.coordinates;
      }
      if (points.point_data[pointInd].tag === a.lg1) {
        t = points.point_data[pointInd].geometry.coordinates;
      }
    }
    links.push({
      source: s,
      target: t,
      sourceTag: a.lg2,
      targetTag: a.lg1,
      stage: a.repo,
      stems: a.stems,
      direction: a.direction,
      filtered: "true" // If filtered is true, make flyer visible.
    });
  });

  // build geoJSON features from links array
  links.forEach(function(e, i, a) {
    var feature = {
      type: "Feature",
      geometry: { type: "LineString", coordinates: [e.source, e.target] },
      stage: e.stage,
      sourceTag: e.sourceTag,
      targetTag: e.targetTag,
      direction: e.direction
    };
    arcLines.push(feature);
  });

  svg
    .append("g")
    .attr("class", "arcs")
    .selectAll("path")
    .data(arcLines)
    .enter()
    .append("path")
    .attr("class", "arc")
    .attr("d", path)
    .attr("stage", d => d.stage)
    .attr("sourceTag", d => d.sourceTag)
    .attr("targetTag", d => d.targetTag)
    .attr("direction", d => d.direction);

  svg
    .append("g")
    .attr("class", "flyers")
    .selectAll("path")
    .data(links)
    .enter()
    .append("path")
    .attr("class", "flyer")
    .attr("sourceTag", d => d.sourceTag)
    .attr("targetTag", d => d.targetTag)
    .attr("d", d => swoosh(flying_arc(d)))
    .style("stroke", d => chooseColor(d))
    .on("mouseover", function(d) {
      //Hovering over flyers for tooltip
      if (d.filtered === "false") {
        return;
      }
      div
        .transition()
        .duration(200)
        .style("opacity", 0.9);
      $(this).css("stroke-width", "4px");
      var arrow = d.direction === "<>" ? "↔" : d.direction === ">" ? "→" : "–";
      var repo =
        d.stage === undefined
          ? "Unknown"
          : d.stage.charAt(0).toUpperCase() + d.stage.slice(1);
      div
        .html(
          d.sourceTag +
            " " +
            arrow +
            " " +
            d.targetTag +
            "<br/>" +
            (d.stems === undefined || d.stems === -1 ? "Unknown" : d.stems) +
            "<br/>" +
            repo
        )
        .style("left", d3.event.pageX + "px")
        .style("top", d3.event.pageY - 28 + "px");
    })
    .on("mouseout", function(d) {
      div
        .transition()
        .duration(500)
        .style("opacity", 0);
      $(this).css("stroke-width", "2px");
    });

  // Create labels and points AFTER flyers and arcs so they appear above
  svg
    .append("g")
    .attr("class", "labels")
    .style("fill", "white")
    .selectAll("text")
    .data(points.point_data)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("coordinate", d => d.geometry.coordinates)
    .text(d => d.tag)
    .on("mouseover", function(d) {
      //Hovering over labels for tooltip
      if ($(this).css("opacity") === "0") {
        return;
      }
      div
        .transition()
        .duration(200)
        .style("opacity", 0.9);

      div
        .html(d.tag + "<br/>" + codeToLanguage(d.tag)) // Looking up full name
        .style("left", d3.event.pageX + "px")
        .style("top", d3.event.pageY - 28 + "px");
    })
    .on("mouseout", function(d) {
      div
        .transition()
        .duration(500)
        .style("opacity", 0);
    });

  // Points
  svg
    .append("g")
    .attr("class", "points")
    .style("fill", "#e0e0e0")
    .selectAll("text")
    .data(points.point_data)
    .enter()
    .append("path")
    .attr("class", "point")
    .attr("d", path)
    .attr("coordinate", d => d.geometry.coordinates)
    .attr("tag", d => d.tag)
    .on("mouseover", function(d) {
      //Also added hovering over points for tooltip
      if ($(this).css("opacity") === "0") {
        return;
      }
      div
        .transition()
        .duration(200)
        .style("opacity", 0.9);

      div
        .html(d.tag + "<br/>" + codeToLanguage(d.tag))
        .style("left", d3.event.pageX + "px")
        .style("top", d3.event.pageY - 28 + "px");
    })
    .on("mouseout", function(d) {
      div
        .transition()
        .duration(500)
        .style("opacity", 0);
    })
    .on("click", function(d) {
      if (d.tag === currentFiltered) {
        filterPoint(currentFiltered);
        currentFiltered = "none";
      } else if (currentFiltered === "none") {
        filterPoint(d.tag);
        currentFiltered = d.tag;
      } else {
        filterPoint(currentFiltered);
        filterPoint(d.tag);
        currentFiltered = d.tag;
      }
    });

  // Populate the filter point list
  var alphaPointList = [];
  for (var i = 0; i < points.point_data.length; i++) {
    alphaPointList.push(points.point_data[i].tag);
  }
  alphaPointList.sort();
  for (var i = 0; i < alphaPointList.length; i++) {
    var newPoint = $("<a>")
      .attr("id", "point" + alphaPointList[i])
      .attr("class", "dropdown-select")
      .attr("onclick", "filterPoint('" + alphaPointList[i] + "')")
      .text(alphaPointList[i]);
    $("#pointList").append(newPoint);
  }

  refresh();
  handleUnusedPoints();
}

// Position and hiding labels
function position_labels() {
  var centerPos = proj.invert([fixedWidth / 2, fixedHeight / 2]);

  svg
    .selectAll(".label")
    .attr("label-anchor", function(d) {
      var x = proj(d.geometry.coordinates)[0];
      return x < width / 2 - 20
        ? "end"
        : x < width / 2 + 20
        ? "middle"
        : "start";
    })
    .attr("transform", function(d) {
      var loc = proj(d.geometry.coordinates),
        x = loc[0],
        y = loc[1];
      var offset = x < width / 2 ? -5 : 5;
      return "translate(" + (x + offset) + "," + (y - 2) + ")";
    })
    .style("display", function(d) {
      var d = d3.geoDistance(d.geometry.coordinates, centerPos);
      return d > 1.57 ? "none" : "inline";
    });
}

// Chooses flyer color based on language pair stage
// trunk green, staging yellow, nursery orange, incubator red
function chooseColor(d) {
  if (!colorByStems) {
    switch (d.stage) {
      case "trunk":
        return TRUNK_COLOR;
      case "staging":
        return STAGING_COLOR;
      case "nursery":
        return NURSERY_COLOR;
      case "incubator":
        return INCUBATOR_COLOR;
      default:
        return UNKNOWN_COLOR;
    }
  }
  if (d.stems === undefined || d.stems === -1) {
    return UNKNOWN_COLOR;
  }
  try {
    // Even if d.stems is a non-numerical String, it does not throw an error...
    if (isNaN(Math.log(d.stems))) {
      throw new Error("Node has unknown stem count");
    }
    // Shunt <= 99 to colour 0
    return d3
      .scaleOrdinal()
      .domain(translationClasses)
      .range(translationClassColours)(d.stage)[
      d.stems <= 99 ? 0 : parseInt(Math.log(d.stems) / Math.LN10) - 1
    ];
  } catch (e) {
    // Give it the lightest colour if the stem count is unknown
    return d3
      .scaleOrdinal()
      .domain(translationClasses)
      .range(translationClassColours)(d.stage)[0];
  }
}

let colorByStems = false;
function colorStem() {
  colorByStems = !colorByStems;
  let button = document.getElementById("colorStem");
  if (colorByStems) {
    button.innerHTML = " Color By Stage";
  } else {
    button.innerHTML = " Color By Stems";
  }
  svg.selectAll(".flyer").style("stroke", d => chooseColor(d));
  refresh();
}

function flying_arc(pts) {
  var source = pts.source,
    target = pts.target;

  var mid = location_along_arc(source, target, 0.5);
  var result = [proj(source), sky(mid), proj(target)];

  return result;
}

function codeToLanguage(code) {
  // Presuming that it is in fact a three-letter terminological code
  if (codeToLangTable[code] === undefined) {
    return "Unknown";
  }
  return codeToLangTable[code];
}

function refresh() {
  svg.selectAll(".land").attr("d", path);
  svg.selectAll(".point").attr("d", path);
  svg.selectAll(".mesh").attr("d", path);
  svg.selectAll(".arc").attr("d", path);
  // svg.selectAll(".graticule").attr("d", path); //This adds long and lat lines

  position_labels();

  svg
    .selectAll(".flyer")
    .attr("d", d => swoosh(flying_arc(d)))
    .attr("marker-mid", d => addMarker(d))
    .attr("opacity", d => fadeAtEdge(d));
}

function addMarker(d) {
  if (d.direction === "<>") {
    return "url(#" + d.stage + "twoway)";
  } else if (d.direction === ">") {
    return "url(#" + d.stage + "oneway)";
  } else {
    return "";
  }
}

function setPoints(o1, o2) {
  svg.selectAll(".point").style("opacity", o1);
  svg.selectAll(".label").style("opacity", o2);
}

// Update globe and repo filter array
function selectRepoFilter(f) {
  if ($("#checkmark" + f).length === 0) {
    $("#filter" + f).html(
      f + "<i id=checkmark" + f + " class='fa fa-check checkmark'></i>"
    );
    currentRepoFilter.push(f);
  } else {
    $("#checkmark" + f).remove();
    currentRepoFilter.splice(currentRepoFilter.indexOf(f), 1);
  }

  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
}

// Update direction filter and globe
function selectDirFilter(dir) {
  if ($("#checkmarkDir" + dir).length === 0) {
    $("#dir" + dir).html(
      dir + "<i id=checkmarkDir" + dir + " class='fa fa-check checkmark'></i>"
    );
    currentDirFilter.push(dir);
  } else {
    $("#checkmarkDir" + dir).remove();
    currentDirFilter.splice(currentDirFilter.indexOf(dir), 1);
  }

  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
}

let currentFiltered = "none";
// Update point filter and globe
function filterPoint(p) {
  var needToRotate = false;
  if ($("#checkmarkPoint" + p).length === 0) {
    $("#point" + p).html(
      p + "<i id=checkmarkPoint" + p + " class='fa fa-check checkmark'></i>"
    );
    currentPointFilter.push(p);
    needToRotate = true;
  } else {
    $("#checkmarkPoint" + p).remove();
    currentPointFilter.splice(currentPointFilter.indexOf(p), 1);
  }

  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
  if (needToRotate) {
    rotateToPoint(p);
  }
}

function resetFilters() {
  $(".checkmark").remove();

  currentRepoFilter = [];
  currentPointFilter = [];
  currentDirFilter = [];

  $("#pointSearch")[0].value = "";
  filterSearchPoints();

  $("#pointCheckbox").prop("checked", false);
  $("#fullDepthCheckbox").prop("checked", false);
  $("#toggleShadowsCheckbox").prop("checked", true);
  $("#colorStemCheckbox").prop("checked", true);

  svg.selectAll(".flyer").style("stroke", d => chooseColor(d));
  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
}

function filterArc(s, t) {
  for (var i = 0; i < svg.selectAll(".arc")._groups[0].length; i++) {
    if (
      svg.selectAll(".arc")._groups[0][i].getAttribute("sourceTag") === s &&
      svg.selectAll(".arc")._groups[0][i].getAttribute("targetTag") === t
    ) {
      svg.selectAll(".arc")._groups[0][i].setAttribute("opacity", 0);
      break;
    }
  }
}

let filterReturn;
function filterArcsAndFlyers() {
  if ($("#toggleShadowsCheckbox").prop("checked")) {
    for (i = 0; i < svg.selectAll(".arc")._groups[0].length; i++) {
      svg.selectAll(".arc")._groups[0][i].setAttribute("opacity", 1);
    }
  } else {
    for (i = 0; i < svg.selectAll(".arc")._groups[0].length; i++) {
      svg.selectAll(".arc")._groups[0][i].setAttribute("opacity", 0);
    }
  }
  if ($("#fullDepthCheckbox").prop("checked") === true) {
    for (i = 0; i < svg.selectAll(".point")._groups[0].length; i++) {
      visitMap.set(
        svg.selectAll(".point")._groups[0][i].getAttribute("tag"),
        false
      );
    }
    for (var i = 0; i < currentPointFilter.length; i++) {
      dfs(currentPointFilter[i]);
    }
  }

  svg.selectAll(".flyer").attr("opacity", function(d) {
    if (
      $("#fullDepthCheckbox").prop("checked") === false ||
      currentPointFilter.length === 0
    ) {
      d.filtered = "true";
    } else {
      if (d.filtered === "temp") {
        d.filtered = "true";
      } else {
        d.filtered = "false";
        filterArc(d.sourceTag, d.targetTag);
      }
    }

    if (
      currentPointFilter.length > 0 &&
      $("#fullDepthCheckbox").prop("checked") === false
    ) {
      filterReturn = 0;
      for (var i = 0; i < currentPointFilter.length; i++) {
        if (
          d.sourceTag === currentPointFilter[i] ||
          d.targetTag === currentPointFilter[i]
        ) {
          filterReturn = 1;
          break;
        }
      }
      if (filterReturn === 0) {
        d.filtered = "false";
        filterArc(d.sourceTag, d.targetTag);
      }
    }

    if (currentRepoFilter.length > 0) {
      filterReturn = 0;
      for (var i = 0; i < currentRepoFilter.length; i++) {
        if (d.stage === currentRepoFilter[i].toLowerCase()) {
          filterReturn = 1;
          break;
        }
      }
      if (filterReturn === 0) {
        d.filtered = "false";
        filterArc(d.sourceTag, d.targetTag);
      }
    }

    if (currentDirFilter.length > 0) {
      filterReturn = 0;
      for (var i = 0; i < currentDirFilter.length; i++) {
        if (
          (d.direction === "<>" && currentDirFilter[i] === "Bidirectional") ||
          (d.direction === ">" && currentDirFilter[i] === "Unidirectional") ||
          (currentDirFilter[i] === "Unknown" &&
            d.direction !== "<>" &&
            d.direction !== ">")
        ) {
          filterReturn = 1;
          break;
        }
      }
      if (filterReturn === 0) {
        d.filtered = "false";
        filterArc(d.sourceTag, d.targetTag);
      }
    }

    if ($("#unknownStemCheckbox").prop("checked")) {
      if (!(d.stems === undefined || d.stems === -1)) {
        if (d.stems < parseInt($("#stemFilterCount").attr("value"))) {
          d.filtered = "false";
          filterArc(d.sourceTag, d.targetTag);
        }
      }
    } else {
      if (d.stems < parseInt($("#stemFilterCount").attr("value"))) {
        d.filtered = "false";
        filterArc(d.sourceTag, d.targetTag);
      }
    }
    return fadeAtEdge(d);
  });
}

function dfs(curr) {
  if (visitMap.get(curr) === true) {
    return;
  }
  visitMap.set(curr, true);
  svg.selectAll(".flyer").attr("opacity", function(d) {
    if (d.sourceTag === curr) {
      d.filtered = "temp";
      dfs(d.targetTag);
    } else if (d.targetTag === curr) {
      d.filtered = "temp";
      dfs(d.sourceTag);
    }
    return fadeAtEdge(d);
  });
}

$(".eP").click(function(e) {
  e.stopPropagation();
});

$("body,html").click(function(e) {
  if ($("#sidenav").css("left") === "0px") {
    closeNav();
  }
});

function openNav() {
  $("#sidenav").css("left", "0px");
}

function closeNav() {
  $("#sidenav").css("left", "-180px");
}

function toggleDropdown(t, id) {
  if ($(id).css("display") === "none") {
    $(".dropdown-content").css("display", "none");
    for (var i = 0; i < $(".dropdown-content").length; i++) {
      var filterButton = $(".dropdown-content")[i].previousElementSibling;
      filterButton.innerHTML =
        filterButton.innerHTML.slice(0, filterButton.innerHTML.indexOf("<")) +
        "<i class='fa fa-caret-right'></i>";
    }
  }
  $(id).toggle();
  if ($(id).css("display") === "none") {
    t.innerHTML =
      t.innerHTML.slice(0, t.innerHTML.indexOf("<")) +
      "<i class='fa fa-caret-right'></i>";
  } else {
    t.innerHTML =
      t.innerHTML.slice(0, t.innerHTML.indexOf("<")) +
      "<i class='fa fa-caret-down'></i>";
  }
  var sidenavHeight = $("#sidenav").css("height");
  var val = parseInt(sidenavHeight.substring(0, sidenavHeight.length - 2));
  var offset = 487;
  var total = val - offset >= 0 ? val - offset : 0;
  $("#pointList").css("max-height", total + "px");
}

function checkPoints() {
  $("#pointCheckbox").prop("checked", !$("#pointCheckbox").prop("checked"));
  handleUnusedPoints();
}

function fullDepth() {
  $("#fullDepthCheckbox").prop(
    "checked",
    !$("#fullDepthCheckbox").prop("checked")
  );
  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
}

function toggleShadows() {
  $("#toggleShadowsCheckbox").prop(
    "checked",
    !$("#toggleShadowsCheckbox").prop("checked")
  );
  filterArcsAndFlyers();
  refresh();
}

$("#stemFilterSlider").on("input", function() {
  $("#stemFilterCount").attr("value", this.value);
});

$("#stemFilterSlider").on("change", function() {
  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
});

$("#stemFilterCount").on("change", function() {
  var val = this.value;
  val = Math.max(0, val);
  val = Math.min(100000, val);
  $(this).attr("value", val);
  $("#stemFilterSlider").attr("value", this.value);
  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
});

function unknownStem() {
  $("#unknownStemCheckbox").prop(
    "checked",
    !$("#unknownStemCheckbox").prop("checked")
  );
  filterArcsAndFlyers();
  refresh();
  handleUnusedPoints();
}

function filterSearchPoints() {
  var searchValue = $("#pointSearch")[0].value;
  var points = $("#pointList")[0].children;
  var searchEmpty = 0;
  for (var i = 0; i < points.length; i++) {
    if (
      $(points[i])
        .text()
        .substring(0, searchValue.length)
        .toUpperCase() !== searchValue.toUpperCase()
    ) {
      $(points[i]).css("display", "none");
    } else {
      $(points[i]).css("display", "");
      searchEmpty = 1;
    }
  }
  if (searchEmpty === 0) {
    $("#pointList").css("min-height", 0);
  }
  if (searchEmpty === 1 || searchValue === "") {
    $("#pointList").css("min-height", 42);
  }
}

function handleUnusedPoints() {
  if ($("#pointCheckbox").prop("checked") === false) {
    setPoints(0, 0);
  } else {
    setPoints(0.6, 0.9);
    return;
  }

  svg.selectAll(".flyer").attr("opacity", function(d) {
    if (this.getAttribute("opacity") !== "0") {
      var dsource = String(d.source[0]) + "," + String(d.source[1]);
      var dtarget = String(d.target[0]) + "," + String(d.target[1]);
      var points = svg.selectAll(".point")._groups[0];
      for (var j = 0; j < points.length; j++) {
        if (points[j].getAttribute("coordinate") === dsource) {
          points[j].setAttribute("style", "opacity: 0.6");
        }
        if (points[j].getAttribute("coordinate") === dtarget) {
          points[j].setAttribute("style", "opacity: 0.6");
        }
      }
      var labels = svg.selectAll(".label")._groups[0];
      for (var k = 0; k < labels.length; k++) {
        if (labels[k].getAttribute("coordinate") === dsource) {
          labels[k].setAttribute("style", "opacity: 0.9");
        }
        if (labels[k].getAttribute("coordinate") === dtarget) {
          labels[k].setAttribute("style", "opacity: 0.9");
        }
      }
    }
    return fadeAtEdge(d);
  });

  for (var i = 0; i < svg.selectAll(".point")._groups[0].length; i++) {
    if (
      currentPointFilter.indexOf(
        svg.selectAll(".point")._groups[0][i].getAttribute("tag")
      ) !== -1
    ) {
      svg
        .selectAll(".point")
        ._groups[0][i].setAttribute("style", "opacity: 0.6");
    }
  }
  for (var i = 0; i < svg.selectAll(".label")._groups[0].length; i++) {
    if (
      currentPointFilter.indexOf(
        svg.selectAll(".label")._groups[0][i].innerHTML
      ) !== -1
    ) {
      svg
        .selectAll(".label")
        ._groups[0][i].setAttribute("style", "opacity: 0.9");
    }
  }
  refresh();
}

function fadeAtEdge(d) {
  if (d.filtered === "false") {
    return 0;
  }

  var centerPos = proj.invert([fixedWidth / 2, fixedHeight / 2]),
    start,
    end;
  // function is called on 2 different data structures..
  if (d.source) {
    start = d.source;
    end = d.target;
  } else {
    start = d.coordinates1;
    end = d.coordinates2;
  }

  var start_dist = 1.57 - d3.geoDistance(start, centerPos),
    end_dist = 1.57 - d3.geoDistance(end, centerPos);

  var fade = d3
    .scaleLinear()
    .domain([-0.1, 0])
    .range([0, 0.1]);
  var dist = start_dist < end_dist ? start_dist : end_dist;
  return fade(dist);
}

function location_along_arc(start, end, loc) {
  var interpolator = d3.geoInterpolate(start, end);
  return interpolator(loc);
}

function rotateToPoint(p) {
  var rotate = proj.rotate();
  var coords;
  for (var i = 0; i < svg.selectAll(".point")._groups[0].length; i++) {
    if (svg.selectAll(".point")._groups[0][i].getAttribute("tag") === p) {
      coords = svg.selectAll(".point")._groups[0][i].getAttribute("coordinate");
    }
  }
  var q = coords.split(",");
  d3.transition()
    .duration(1000)
    .tween("rotate", function() {
      var r = d3.interpolate(proj.rotate(), [
        -parseInt(q[0]),
        -parseInt(q[1]),
        rotate[2]
      ]);
      return function(t) {
        proj.rotate(r(t));
        sky.rotate(r(t));
        o0 = proj.rotate();
        refresh();
      };
    });
}

// modified from http://bl.ocks.org/tlfrd/df1f1f705c7940a6a7c0dca47041fec8
var o0;

/********** versor.js **********/
var acos = Math.acos,
  asin = Math.asin,
  atan2 = Math.atan2,
  cos = Math.cos,
  max = Math.max,
  min = Math.min,
  PI = Math.PI,
  sin = Math.sin,
  sqrt = Math.sqrt,
  radians = PI / 180,
  degrees = 180 / PI;

// Returns the unit quaternion for the given Euler rotation angles [λ, φ, γ].
function versor(e) {
  var l = (e[0] / 2) * radians,
    sl = sin(l),
    cl = cos(l), // λ / 2
    p = (e[1] / 2) * radians,
    sp = sin(p),
    cp = cos(p), // φ / 2
    g = (e[2] / 2) * radians,
    sg = sin(g),
    cg = cos(g); // γ / 2
  return [
    cl * cp * cg + sl * sp * sg,
    sl * cp * cg - cl * sp * sg,
    cl * sp * cg + sl * cp * sg,
    cl * cp * sg - sl * sp * cg
  ];
}

// Returns Cartesian coordinates [x, y, z] given spherical coordinates [λ, φ].
versor.cartesian = function(e) {
  var l = e[0] * radians,
    p = e[1] * radians,
    cp = cos(p);
  return [cp * cos(l), cp * sin(l), sin(p)];
};

// Returns the Euler rotation angles [λ, φ, γ] for the given quaternion.
versor.rotation = function(q) {
  return [
    atan2(
      2 * (q[0] * q[1] + q[2] * q[3]),
      1 - 2 * (q[1] * q[1] + q[2] * q[2])
    ) * degrees,
    asin(max(-1, min(1, 2 * (q[0] * q[2] - q[3] * q[1])))) * degrees,
    atan2(
      2 * (q[0] * q[3] + q[1] * q[2]),
      1 - 2 * (q[2] * q[2] + q[3] * q[3])
    ) * degrees
  ];
};

// Returns the quaternion to rotate between two cartesian points on the sphere.
versor.delta = function(v0, v1) {
  var w = cross(v0, v1),
    l = sqrt(dot(w, w));
  if (!l) return [1, 0, 0, 0];
  var t = acos(max(-1, min(1, dot(v0, v1)))) / 2,
    s = sin(t); // t = θ / 2
  return [cos(t), (w[2] / l) * s, (-w[1] / l) * s, (w[0] / l) * s];
};

// Returns the quaternion that represents q0 * q1.
versor.multiply = function(q0, q1) {
  return [
    q0[0] * q1[0] - q0[1] * q1[1] - q0[2] * q1[2] - q0[3] * q1[3],
    q0[0] * q1[1] + q0[1] * q1[0] + q0[2] * q1[3] - q0[3] * q1[2],
    q0[0] * q1[2] - q0[1] * q1[3] + q0[2] * q1[0] + q0[3] * q1[1],
    q0[0] * q1[3] + q0[1] * q1[2] - q0[2] * q1[1] + q0[3] * q1[0]
  ];
};

function cross(v0, v1) {
  return [
    v0[1] * v1[2] - v0[2] * v1[1],
    v0[2] * v1[0] - v0[0] * v1[2],
    v0[0] * v1[1] - v0[1] * v1[0]
  ];
}

function dot(v0, v1) {
  return v0[0] * v1[0] + v0[1] * v1[1] + v0[2] * v1[2];
}

/********** end of versor.js **********/

var v0, r0, q0;

window.addEventListener(
  "touchmove",
  function(e) {
    e.preventDefault();
  },
  false
);

// Zooms by twice or half
function zoomIn() {
  svg
    .transition()
    .duration(500)
    .call(zoom.scaleBy, 2);
}

function zoomOut() {
  svg
    .transition()
    .duration(500)
    .call(zoom.scaleBy, 0.5);
}

// Start off zoomed based off of window size
resetZoom();

function zoomstart() {
  if (d3.event.sourceEvent) {
    v0 = versor.cartesian(proj.invert(d3.mouse(this)));
    r0 = proj.rotate();
    q0 = versor(r0);
  }
}

function zoomed() {
  var scale = d3.event.transform.k;
  if (width === scale) {
    // If not zooming, rotating.
    var v1 = versor.cartesian(proj.rotate(r0).invert(d3.mouse(this)));
    var q1 = versor.multiply(q0, versor.delta(v0, v1));
    var r1 = versor.rotation(q1);
    proj.rotate(r1);
    sky.rotate(r1);
    refresh();
  } else {
    width = scale;

    proj = d3
      .geoOrthographic()
      .translate([fixedWidth / 2, fixedHeight / 2])
      .clipAngle(90)
      .scale(scale / 4);

    sky = d3
      .geoOrthographic()
      .translate([fixedWidth / 2, fixedHeight / 2])
      .clipAngle(90)
      .scale(scale / 3);

    path = d3
      .geoPath()
      .projection(proj)
      .pointRadius(3);

    svg.select("#globe").attr("r", scale / 4);

    if (o0) {
      proj.rotate(o0);
      sky.rotate(o0);
    }

    refresh();
  }
}

function zoomend() {
  o0 = proj.rotate();
}

// Resets zoom to fit window size
function resetZoom() {
  var initial = 2;
  svg
    .transition()
    .call(
      zoom.transform,
      d3.zoomIdentity.scale(
        Math.min(initial * fixedHeight, initial * fixedWidth)
      )
    );
}

// Zoom-in with + key and zoom-out with - key and reset with 0
window.onkeydown = function(e) {
  if (navigator.userAgent.search("Chrome") >= 0) {
    if (e.keyCode === 187) {
      e.preventDefault();
      zoomIn();
    }
    if (e.keyCode === 189) {
      e.preventDefault();
      zoomOut();
    }
    if (e.keyCode === 48) {
      e.preventDefault();
      resetZoom();
    }
  } else if (navigator.userAgent.search("Firefox") >= 0) {
    if (e.keyCode === 61) {
      e.preventDefault();
      zoomIn();
    }
    if (e.keyCode === 173) {
      e.preventDefault();
      zoomOut();
    }
    if (e.keyCode === 48) {
      e.preventDefault();
      resetZoom();
    }
  }
};
