/**
 * New node file
 */

var Format = {
  blank : "",
  hline : "=====================================================",
  dotline : "          .........."
};

var InitMode = {
  NOTHING : 0,
  UNDEFINED_ONLY : 1,
  OBJECT_PROTOTYPE : 2,
  FULL : -1,
};

module.exports = {
  Format : Format,
  InitMode : InitMode,
};
