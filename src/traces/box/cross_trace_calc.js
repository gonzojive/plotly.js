/**
* Copyright 2012-2018, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var Axes = require('../../plots/cartesian/axes');
var Lib = require('../../lib');

var orientations = ['v', 'h'];


function getPosition(di) {
    return di.pos;
}

function crossTraceCalc(gd, plotinfo) {
    var calcdata = gd.calcdata;
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    for(var i = 0; i < orientations.length; i++) {
        var orientation = orientations[i];
        var posAxis = orientation === 'h' ? ya : xa;
        var boxList = [];
        var minPad = 0;
        var maxPad = 0;

        // make list of boxes / candlesticks
        // For backward compatibility, candlesticks are treated as if they *are* box traces here
        for(var j = 0; j < calcdata.length; j++) {
            var cd = calcdata[j];
            var t = cd[0].t;
            var trace = cd[0].trace;

            if(trace.visible === true &&
                    (trace.type === 'box' || trace.type === 'candlestick') &&
                    !t.empty &&
                    (trace.orientation || 'v') === orientation &&
                    trace.xaxis === xa._id &&
                    trace.yaxis === ya._id
              ) {
                boxList.push(j);

                if(trace.boxpoints) {
                    minPad = Math.max(minPad, trace.jitter - trace.pointpos - 1);
                    maxPad = Math.max(maxPad, trace.jitter + trace.pointpos - 1);
                }
            }
        }

        setPositionOffset('box', gd, boxList, posAxis, [minPad, maxPad]);
    }
}

function setPositionOffset(traceType, gd, boxList, posAxis, pad) {
    var calcdata = gd.calcdata;
    var fullLayout = gd._fullLayout;
    var pointList = [];

    // N.B. reused in violin
    var numKey = traceType === 'violin' ? '_numViolins' : '_numBoxes';

    var i, j, calcTrace;

    // make list of box points
    for(i = 0; i < boxList.length; i++) {
        calcTrace = calcdata[boxList[i]];
        for(j = 0; j < calcTrace.length; j++) {
            pointList.push(calcTrace[j].pos);
        }
    }

    if(!pointList.length) return;

    // box plots - update dPos based on multiple traces
    // and then use for posAxis autorange
    var boxdv = Lib.distinctVals(pointList);
    var dPos = boxdv.minDiff / 2;

    // if there's no duplication of x points,
    // disable 'group' mode by setting counter to 1
    if(pointList.length === boxdv.vals.length) {
        fullLayout[numKey] = 1;
    }

    // check for forced minimum dtick
    Axes.minDtick(posAxis, boxdv.minDiff, boxdv.vals[0], true);

    var gap = fullLayout[traceType + 'gap'];
    var groupgap = fullLayout[traceType + 'groupgap'];
    var padfactor = (1 - gap) * (1 - groupgap) * dPos / fullLayout[numKey];

    // Find maximum trace width
    // we baseline this at dPos
    var maxHalfWidth = dPos;
    for(i = 0; i < boxList.length; i++) {
        calcTrace = calcdata[boxList[i]];

        if(calcTrace[0].trace.width) {
            if(calcTrace[0].trace.width / 2 > maxHalfWidth) {
                maxHalfWidth = calcTrace[0].trace.width / 2;
            }
        }
    }

    for(i = 0; i < boxList.length; i++) {
        calcTrace = calcdata[boxList[i]];
        // set the width of this box
        // override dPos with trace.width if present
        var thisDPos = calcTrace[0].t.dPos = (calcTrace[0].trace.width / 2) || dPos;
        var positions = calcTrace.map(getPosition);
        // autoscale the x axis - including space for points if they're off the side
        // TODO: this will overdo it if the outermost boxes don't have
        // their points as far out as the other boxes

        var vpadminus = 0;
        var vpadplus = 0;
        if(calcTrace[0].trace.side) {
            if(calcTrace[0].trace.side === 'positive') {
                vpadminus = 0;
                vpadplus = thisDPos + pad[1] * padfactor;
            } else if(calcTrace[0].trace.side === 'negative') {
                vpadminus = thisDPos + pad[0] * padfactor;
                vpadplus = 0;
            }
        } else {
            vpadminus = thisDPos + pad[0] * padfactor;
            vpadplus = thisDPos + pad[1] * padfactor;
        }

        var extremes = Axes.findExtremes(posAxis, positions, {
            vpadminus: vpadminus,
            vpadplus: vpadplus
        });
        calcTrace[0].trace._extremes[posAxis._id] = extremes;
    }

}

module.exports = {
    crossTraceCalc: crossTraceCalc,
    setPositionOffset: setPositionOffset
};
