/*global Class */
/*global sprintf */
/*extern  ABCBeamElem, ABCGraphElem, ABCPrinter, ABCGlyphs, AbcSpacing, getDuration */

var getDuration = function(elem) {
  var d = 0;
  if (elem) {
    if (elem.duration) 
      d = elem.duration;
    else if (elem.pitches && elem.pitches[0])
      d = elem.pitches[0].duration;
  } 
  return d / 8;	// the parser calls a 1 an eigth note.
};

var getDurlog = function(duration) {
  return Math.floor(Math.log(duration)/Math.log(2));
}

var AbcSpacing = function() {};
AbcSpacing.FONTEM = 360;
AbcSpacing.FONTSIZE = 30;
AbcSpacing.STEP = AbcSpacing.FONTSIZE*93/720;
AbcSpacing.SPACE = 10;
AbcSpacing.TOPNOTE = 20;
AbcSpacing.STAVEHEIGHT = 100;

 function ABCStaffElement(printer, y) {
  this.printer = printer;
  this.children = [];
  this.otherchildren = []; // ties, slurs, beams, triplets
  this.w = 0;
  this.y = y;
}

ABCStaffElement.prototype.addChild = function (child) {
  this.children[this.children.length] = child;
};

ABCStaffElement.prototype.addOther = function (child) {
  this.otherchildren[this.otherchildren.length] = child;
};

ABCStaffElement.prototype.layout = function (spacing) {
  var x = 0;
  var extraroom = 0;
  var durationroom = 0;
  var room = 0;
  for (var i=0, ii=this.children.length; i<ii; i++) {
    var child = this.children[i];
    var er = child.getExtraWidth() - room;
    if (er>0) {
      x+=child.getExtraWidth();
      extraroom+=er;
    }
    child.x=x;
    x+=(spacing*Math.sqrt(child.duration*8));
    er = child.x+child.getMinWidth() - x;
    if (er > 0) {
      x = child.x+child.getMinWidth();
      (i!=ii-1) && (x+=child.minspacing);
      extraroom+=er;
      room = 0;
    } else {
      room = -er;
      durationroom+=(spacing*Math.sqrt(child.duration*8));
    }
  }
  this.w = x;
  this.extraroom = extraroom;
}

ABCStaffElement.prototype.draw = function () {
  for (var i=0; i<this.children.length; i++) {
    this.children[i].draw(this.printer);
  }
  for (var i=0; i<this.otherchildren.length; i++) {
    this.otherchildren[i].draw(this.printer,10,this.w-1);
  }
  this.printer.printStave(this.w-1);
};


function ABCAbsoluteElement(abcelem, duration, minspacing) { // spacing which must be taken on top of the width
  this.abcelem = abcelem;
  this.duration = duration;
  this.minspacing = minspacing || 0;
  this.x = 0;
  this.children = [];
  this.heads = [];
  this.extra = [];
  this.extraw = 0;
  this.decs = [];
  this.w = 0;
  this.right = [];
}

ABCAbsoluteElement.prototype.getMinWidth = function () { // absolute space taken to the right of the note
  return this.w;
};

ABCAbsoluteElement.prototype.getExtraWidth = function () { // space needed to the left of the note
  return -this.extraw;
};

ABCAbsoluteElement.prototype.addExtra = function (extra) {
  if (extra.dx<this.extraw) this.extraw = extra.dx;
  this.extra[this.extra.length] = extra;
  this.addChild(extra);
};

ABCAbsoluteElement.prototype.addHead = function (head) {
  this.heads[this.heads.length] = head;
  this.addRight(head);
};

ABCAbsoluteElement.prototype.addRight = function (right) {
  if (right.dx+right.w>this.w) this.w = right.dx+right.w;
  this.right[this.right.length] = right;
  this.addChild(right);
};

ABCAbsoluteElement.prototype.addChild = function (child) {
  this.children[this.children.length] = child;
};

ABCAbsoluteElement.prototype.draw = function (printer) {
  this.elemset = printer.paper.set();
  for (var i=0; i<this.children.length; i++) {
    this.elemset.push(this.children[i].draw(printer,this.x));
  }
  var self = this;
  this.elemset.mouseup(function (e) {
      printer.notifySelect(self);
    });
};

ABCAbsoluteElement.prototype.highlight = function () {
  this.elemset.attr({fill:"#ff0000"});
}

ABCAbsoluteElement.prototype.unhighlight = function () {
  this.elemset.attr({fill:"#000000"});
}

function ABCRelativeElement(c, dx, w, pitch, opt) {
  opt = opt || {};
  this.x = 0;
  this.c = c;      // character or path or string
  this.dx = dx;    // relative x position
  this.w = w;      // minimum width taken up by this element (can include gratuitous space)
  this.pitch = pitch; // relative y position by pitch
  this.scalex = opt["scalex"] || 1; // should the character/path be scaled?
  this.scaley = opt["scaley"] || 1; // should the character/path be scaled?
  this.type = opt["type"] || "symbol"; // cheap types.
  this.pitch2 = opt["pitch2"];
  this.linewidth = opt["linewidth"];
}

ABCRelativeElement.prototype.draw = function (printer, x) {
  this.x = x+this.dx;
  switch(this.type) {
  case "symbol":
    if (this.c===null) return null;
    this.graphelem = printer.printSymbol(this.x, this.pitch, this.c, 0, 0); break;
  case "debug":
    this.graphelem = printer.debugMsg(this.x, this.c); break;
  case "debugLow":
    this.graphelem = printer.debugMsgLow(this.x, this.c); break;
  case "text":
    this.graphelem = printer.printText(this.x, this.pitch, this.c); break;
  case "stem":
    this.graphelem = printer.printStem(this.x, this.linewidth, printer.calcY(this.pitch), printer.calcY(this.pitch2)); break;
  case "ledger":
    this.graphelem = printer.printStaveLine(this.x, this.x+this.w, this.pitch); break;
  }
  if (this.scalex!=1 && this.graphelem) {
    this.graphelem.scale(this.scalex, this.scaley, this.x, printer.calcY(this.pitch));
  }
  return this.graphelem;
};

function ABCEndingElem (text, anchor1, anchor2) {
  this.text = text; // text to be displayed top left
  this.anchor1 = anchor1; // must have a .x property or be null (means starts at the "beginning" of the line - after keysig)
  this.anchor2 = anchor2; // must have a .x property or be null (means ends at the end of the line)
}

ABCEndingElem.prototype.draw = function (printer, linestartx, lineendx) {
  if (this.anchor1) {
    linestartx = this.anchor1.x+this.anchor1.w;
    printer.paper.path(sprintf("M %f %f L %f %f",
			       linestartx, printer.y, linestartx, printer.y+10)).attr({stroke:"#000000"});
    printer.printText(linestartx+5, 18.5, this.text);
  }

  if (this.anchor2) {
    lineendx = this.anchor2.x;
    printer.paper.path(sprintf("M %f %f L %f %f",
			   lineendx, printer.y, lineendx, printer.y+10)).attr({stroke:"#000000"});
  }
  printer.paper.path(sprintf("M %f %f L %f %f",
			    linestartx, printer.y, lineendx, printer.y)).attr({stroke:"#000000"});
  
}

function ABCTieElem (anchor1, anchor2, above) {
  this.anchor1 = anchor1; // must have a .x and a .pitch property or be null (means starts at the "beginning" of the line - after keysig)
  this.anchor2 = anchor2; // must have a .x and a .pitch property or be null (means ends at the end of the line)
  this.above = above; // true if the arc curves above
}

ABCTieElem.prototype.draw = function (printer, linestartx, lineendx) {
  // TODO end and beginning of line
  if (this.anchor1 && this.anchor2) {
    printer.drawArc(this.anchor1.x, this.anchor2.x, this.anchor1.pitch, this.anchor2.pitch,  this.above);
  }
};

function ABCTripletElem (number, anchor1, anchor2, above) {
  this.anchor1 = anchor1; // must have a .x and a .pitch property or be null (means starts at the "beginning" of the line - after keysig)
  this.anchor2 = anchor2; // must have a .x and a .pitch property or be null (means ends at the end of the line)
  this.above = above; // true if the arc curves above
  this.number = number;
};

ABCTripletElem.prototype.draw = function (printer, linestartx, lineendx) {
  // TODO end and beginning of line
  if (this.anchor1 && this.anchor2) {
    printer.printText((this.anchor1.x+this.anchor2.x)/2, this.above?16:-1, this.number);
  }
};

function ABCBeamElem () {
  this.elems = []; // all the ABCAbsoluteElements
  this.total = 0;
  this.allrests = true;
}

ABCBeamElem.prototype.add = function(abselem) {
  this.allrests = this.allrests && abselem.abcelem.rest_type;
  this.elems[this.elems.length] = abselem;
  var pitch = abselem.abcelem.averagepitch;
  this.total += pitch; // TODO CHORD (get pitches from abselem.heads)
  if (!this.min || pitch<this.min) {
    this.min = pitch;
  }
  if (!this.max || pitch>this.max) {
    this.max = pitch;
  }
};

ABCBeamElem.prototype.average = function() {
  try {
    return this.total/this.elems.length;
  } catch (e) {
    return 0;
  }
};

ABCBeamElem.prototype.draw = function(printer) {
  if (this.elems.length === 0 || this.allrests) return;
  this.drawBeam(printer);
  this.drawStems(printer);
};


ABCBeamElem.prototype.drawBeam = function(paper,basey) {

  var average = this.average();
  this.asc = average<6; // hardcoded 6 is B
  this.pos = Math.round(this.asc ? Math.max(average+7,this.max+5) : Math.min(average-7,this.min-5));
  var slant = this.elems[0].abcelem.averagepitch-this.elems[this.elems.length-1].abcelem.averagepitch;
  var maxslant = this.elems.length/2;

  if (slant>maxslant) slant = maxslant;
  if (slant<-maxslant) slant = -maxslant;
  this.starty = printer.calcY(this.pos+Math.floor(slant/2));
  this.endy = printer.calcY(this.pos+Math.floor(-slant/2));
  this.startx = this.elems[0].x;
  if(this.asc) this.startx+=this.elems[0].heads[0].w;
  this.endx = this.elems[this.elems.length-1].x;
  if(this.asc) this.endx+=this.elems[this.elems.length-1].heads[0].w;

  var dy = (this.asc)?AbcSpacing.STEP:-AbcSpacing.STEP;

  printer.paper.path("M"+this.startx+" "+this.starty+" L"+this.endx+" "+this.endy+
	     "L"+this.endx+" "+(this.endy+dy) +" L"+this.startx+" "+(this.starty+dy)+"z").attr({fill: "#000000"});
};

ABCBeamElem.prototype.drawStems = function(printer) {
  var auxbeams = [];  // auxbeam will be {x, y, durlog, single} auxbeam[0] should match with durlog=-4 (16th) (j=-4-durlog)
  for (var i=0,ii=this.elems.length; i<ii; i++) {
    if (this.elems[i].abcelem.rest_type)
      continue;
    var furthesthead = this.elems[i].heads[(this.asc)? 0: this.elems[i].heads.length-1];
    var pitch = furthesthead.pitch + ((this.asc) ? 1/3 : -1/3);
    var y = printer.calcY(pitch);
    var x = furthesthead.x + ((this.asc) ? furthesthead.w : 0);
    var bary=this.getBarYAt(x);
    var dx = (this.asc) ? -0.6 : 0.6;
    printer.printStem(x,dx,y,bary);

    var sy = (this.asc) ? 1.5*AbcSpacing.STEP: -1.5*AbcSpacing.STEP;
    for (var durlog=getDurlog(this.elems[i].duration); durlog<-3; durlog++) {
      if (auxbeams[-4-durlog]) {
	auxbeams[-4-durlog].single = false;
      } else {
	auxbeams[-4-durlog] = {x:x, y:bary+sy*(-4-durlog+1), durlog:durlog, single:true};
      }
    }
    
    for (var j=auxbeams.length-1;j>=0;j--) {
      if (i===ii-1 || getDurlog(this.elems[i+1].duration)>(-j-4)) {
	
	var auxbeamendx = x;
	var auxbeamendy = bary + sy*(j+1);
	var dy = (this.asc) ? AbcSpacing.STEP: -AbcSpacing.STEP;
	if (auxbeams[j].single) {
	  auxbeamendx = (i===0) ? x+5 : x-5;
	  auxbeamendy = this.getBarYAt(auxbeamendx) + sy*(j+1);
	}
	printer.paper.path("M"+auxbeams[j].x+" "+auxbeams[j].y+" L"+auxbeamendx+" "+auxbeamendy+
		   "L"+auxbeamendx+" "+(auxbeamendy+dy) +" L"+auxbeams[j].x+" "+(auxbeams[j].y+dy)+"z").attr({fill: "#000000"});
	auxbeams = auxbeams.slice(0,j);
      }
    }
  }
};

ABCBeamElem.prototype.getBarYAt = function(x) {
  return this.starty + (this.endy-this.starty)/(this.endx-this.startx)*(x-this.startx);
};

//--------------------------------------------------------------------PRINTER

function ABCPrinter(paper) {
  this.x = 0;
  this.y = 0;
  this.paper = paper;
  this.space = 3*AbcSpacing.SPACE;
  this.glyphs = new ABCGlyphs(paper);
  this.listeners = [];
  this.selected = [];
}

ABCPrinter.prototype.notifySelect = function (abselem) {
  this.clearSelection();
  this.selected = [abselem];
  abselem.highlight();
  for (var i=0; i<this.listeners.length;i++) {
    this.listeners[i].highlight(abselem.abcelem);
  }
};

ABCPrinter.prototype.clearSelection = function () {
  for (var i=0;i<this.selected.length;i++) {
    this.selected[i].unhighlight();
  }
  this.selected = [];
};

ABCPrinter.prototype.addSelectListener = function (listener) {
  this.listeners[this.listeners.length] = listener;
};

ABCPrinter.prototype.rangeHighlight = function(start,end)
{
  this.clearSelection();
  for (var line=0;line<this.staffs.length; line++) {
    var elems = this.staffs[line].children;
    for (var elem=0; elem<elems.length; elem++) {
      if (elems[elem].abcelem.startChar>=start && elems[elem].abcelem.endChar<=end) {
	this.selected[this.selected.length]=elems[elem];
	elems[elem].highlight();
      }
    }
  }
};

ABCPrinter.prototype.printStaveLine = function (x1,x2, pitch) {
  var dy = 0.35;
  var y = this.calcY(pitch);
  return printer.paper.path(sprintf("M %f %f L %f %f L %f %f L %f %f z", x1, y-dy, x2, y-dy,
		       x2, y+dy, x1, y+dy)).attr({stroke:"none",fill: "#000000"});
};

ABCPrinter.prototype.printStem = function (x, dx, y1, y2) {
  return printer.paper.path(sprintf("M %f %f L %f %f L %f %f L %f %f z", x-0.3, y1, x-0.3, y2,
		       x+dx, y2, x+dx, y1)).attr({stroke:"none",fill: "#000000"});

};

ABCPrinter.prototype.printText = function (x, offset, text) {
  this.paper.text(x, this.calcY(offset), text).attr({"text-anchor":"start"});
};

// assumes this.y is set appropriately
ABCPrinter.prototype.printSymbol = function(x, offset, symbol, start, end) {
  var ycorr = this.glyphs.getYCorr(symbol);
  if (symbol=="") return null;
  var el = this.glyphs.printSymbol(x, this.calcY(offset+ycorr), symbol);
  if (el)
    return el;
  else
    this.debugMsg("no symbol:" +symbol);
  return null;
  //   if (symbol.length<2) {
  //     return el;
  //   } else {
  //     var elemset = this.paper.set();
  //     elemset.push(el);
  //     for (var i=1; i<symbol.length; i++) {
  //       el = this.glyphs.printSymbol(x+elemset.getBBox().width+3, this.calcY(offset+ycorr), symbol[i]);
  //       if (el)
  // 	el.node.setAttribute("abc-pos", "" + start + ',' + end);
  //       else
  // 	this.debugMsg("no symbol:" +symbol);
  //       elemset.push(el);
  //     }
  //     return elemset;
  //   }
};

ABCPrinter.prototype.drawArc = function(x1, x2, pitch1, pitch2, above) {
  x1 = x1 + 6;
  x2 = x2 + 4;
  pitch1 = pitch1 + ((above)?1.5:-1.5);
  pitch2 = pitch2 + ((above)?1.5:-1.5);
  var y1 = this.calcY(pitch1);
  var y2 = this.calcY(pitch2);
  var dy = Math.max(4, (x2-x1)/5);
  var controlx1 = x1+(x2-x1)/5;
  var controly1 = y1+ ((above)?-dy:dy);
  var controlx2 = x2-(x2-x1)/5;
  var controly2 = y2+ ((above)?-dy:dy);
  var thickness = 2;
  return this.paper.path(sprintf("M %f %f C %f %f %f %f %f %f C %f %f %f %f %f %f z", x1, y1, 
				 controlx1, controly1, controlx2, controly2, x2, y2, 
				 controlx2, controly2+thickness, controlx1, controly1+thickness, x1, y1)).attr({stroke:"none", fill: "#000000"});
}

ABCPrinter.prototype.calcY = function(ofs) {
  return this.y+((AbcSpacing.TOPNOTE-ofs)*AbcSpacing.STEP);
};

ABCPrinter.prototype.getElem = function() {
  if (this.abcline.length <= this.pos)
    return null;
  return this.abcline[this.pos];
};

ABCPrinter.prototype.getNextElem = function() {
	if (this.abcline.length <= this.pos+1)
		return null;
    return this.abcline[this.pos+1];
};

ABCPrinter.prototype.nextElemType = function() {
  var elem = this.getElem();
  if (elem === null)
    return "spacer";

  if (elem.el_type === "note" && (getDuration(elem)>=1/4 || elem.end_beam))
    return "spacer";
  
  var nextElem = this.getNextElem();
  if (nextElem === null)
    return "spacer";
  if (nextElem.el_type === "note" &&
      getDuration(nextElem)>=1/4) {
    return "spacer";
  }
  return nextElem.el_type;
};

ABCPrinter.prototype.debugMsg = function(x, msg) {
  this.paper.text(x, this.y, msg);
}

ABCPrinter.prototype.debugMsgLow = function(x, msg) {
  this.paper.text(x, this.y+80, msg);
}

ABCPrinter.prototype.printABC = function(abctune) {
  //this.currenttune = abctune;
  //ABCNote.duration = eval(this.currenttune.header.fields["L"]);
  this.y = 15;
  if (abctune.formatting.stretchlast) { this.paper.text(200, this.y, "Format: stretchlast"); this.y += 20; }
  if (abctune.formatting.staffwidth) { this.paper.text(200, this.y, "Format: staffwidth="+abctune.formatting.staffwidth); this.y += 20; }
  if (abctune.formatting.scale) { this.paper.text(200, this.y, "Format: scale="+abctune.formatting.scale); this.y += 20; }
  this.paper.text(350, this.y, abctune.metaText.title).attr({"font-size":20});
  this.y+=20;
  if (abctune.metaText.author) {this.paper.text(100, this.y, abctune.metaText.author); this.y+=15;}
  if (abctune.metaText.origin) {this.paper.text(100, this.y, "(" + abctune.metaText.origin + ")");this.y+=15;}
  if (abctune.metaText.tempo) {
	  var tempo = "";
	  if (abctune.metaText.tempo.preString) tempo += abctune.metaText.tempo.preString;
	  tempo += ' | ';
	  if (abctune.metaText.tempo.duration) {
		  tempo += abctune.metaText.tempo.duration.join(' ');
		  tempo += " = " + abctune.metaText.tempo.bpm + " ";
	  }
	  tempo += ' | ';
	  if (abctune.metaText.tempo.postString) tempo += abctune.metaText.tempo.postString;
	  this.paper.text(100, this.y+20, "Tempo: " + tempo);
	  this.y+=15;
  }
  this.y+=15;
  this.staffs = [];
  for(var line=0; line<abctune.lines.length; line++) {
    var abcline = abctune.lines[line];
    if (abcline.staff) {
		for (var s = 0; s < abcline.staff.length; s++) {
		  for (var v = 0; v < abcline.staff[s].voices.length; v++) {
			  this.staffs[this.staffs.length] = this.printABCLine(abcline.staff[s].voices[v]);
		  }
		  if (s !== abcline.staff.length-1)
			this.y+= (AbcSpacing.STAVEHEIGHT*0.5);
		}
      this.y+=AbcSpacing.STAVEHEIGHT;
    } else if (abcline.subtitle) {
      this.printSubtitleLine(abcline);
      this.y+=20; //hardcoded
    } else if (abcline.text) {
      this.paper.text(100, this.y, "TEXT: " + abcline.text);
      this.y+=20; //hardcoded
    }
  }
  var extraText = "";	// TODO-PER: This is just an easy way to display this info for now.
  if (abctune.metaText.partOrder) extraText += "Part Order: " + abctune.metaText.partOrder + "\n";
  if (abctune.metaText.notes) extraText += "Notes:\n" + abctune.metaText.notes + "\n";
  if (abctune.metaText.book) extraText += "Book: " + abctune.metaText.book + "\n";
  if (abctune.metaText.source) extraText += "Source: " + abctune.metaText.source + "\n";
  if (abctune.metaText.transcription) extraText += "Transcription: " + abctune.metaText.transcription + "\n";
  if (abctune.metaText.rhythm) extraText += "Rhythm: " + abctune.metaText.rhythm + "\n";
  if (abctune.metaText.discography) extraText += "Discography: " + abctune.metaText.discography + "\n";
  if (abctune.metaText.history) extraText += "History: " + abctune.metaText.history + "\n";
  if (abctune.metaText.unalignedWords) extraText += "Words:\n" + abctune.metaText.unalignedWords + "\n";
  var text = this.paper.text(10, this.y+30, extraText).attr({"text-anchor":"start"});
  text.translate(0,text.getBBox().height/2);
};

ABCPrinter.prototype.printSubtitleLine = function(abcline) {
  this.paper.text(100, this.y, abcline.subtitle);
}

ABCPrinter.prototype.printABCLine = function(abcline) {
  this.abcline = abcline;
  this.staff = new ABCStaffElement(this, this.y);
  if (this.partstartelem) {
    this.partstartelem = new ABCEndingElem("", null, null);
    this.staff.addOther(this.partstartelem);
  }
  this.slurs = [];
  this.ties = [];
  for (this.pos=0; this.pos<this.abcline.length; this.pos++) {
    var type = this.getElem().el_type;
    var abselems = this.printABCElement();
    for (var i=0; i<abselems.length; i++) {
      this.staff.addChild(abselems[i]);
    }
  }
  this.staff.layout(this.space);
  var prop = Math.min(1,700/this.staff.w)
  this.staff.layout(this.space*prop);
  this.staff.draw(printer);
  return this.staff;
};


// return an array of ABCAbsoluteElement
ABCPrinter.prototype.printABCElement = function() {
  var elemset = [];
  var elem = this.getElem();
  switch (elem.el_type) {
  case "note":
    elemset = this.printBeam();
    break;
  case "bar":
    elemset[0] = this.printBarLine(elem);
    break;
  case "meter":
    elemset[0] = this.printTimeSignature(elem);
    break;
  case "clef":
    if (elem.type !== 'treble')
      this.debugMsg(10,"clef="+elem.type);
    break;
  case "key":
    elemset[0] = this.printKeySignature(elem);
    break;
  }

  return elemset;
};

ABCPrinter.prototype.printBeam = function() {
  var abselemset = [];
  if (this.nextElemType() === 'note') {
    var beamelem = new ABCBeamElem();

    for (;;) {
      abselem = this.printNote(this.getElem(),true);
      abselemset[abselemset.length] = abselem;
      beamelem.add(abselem);
      if (this.getElem().end_beam !== undefined || this.nextElemType()!=="note") {
		break;
      }
      this.pos++;
    }
    this.staff.addOther(beamelem);
  } else {
    abselemset[0] = this.printNote(this.getElem());
  }
  return abselemset;
};

function sortPitch(elem) {
  do {
    var sorted = true;
    for (var p = 0; p<elem.pitches.length-1; p++) {
      if (elem.pitches[p].pitch>elem.pitches[p+1].pitch) {
	sorted = false;
	var tmp = elem.pitches[p];
	elem.pitches[p] = elem.pitches[p+1];
	elem.pitches[p+1] = tmp;
      }     
    }
  } while (!sorted);
}

ABCPrinter.prototype.printNote = function(elem, nostem) { //stem presence: true for drawing stemless notehead
  var notehead = null;
  var roomtaken = 0; // room needed to the left of the note
  if (elem.pitches==undefined) {
    elem.pitches=[{accidental:elem.accidental, pitch:elem.pitch, duration:elem.duration, startTie: elem.startTie,
		   endTie: elem.endTie, startSlur: elem.startSlur, endSlur: elem.endSlur}]
  }

  var duration = getDuration(elem);
  var durlog = Math.floor(Math.log(duration)/Math.log(2));
  
  var chartable = {rest:{0:"rests.whole", 1:"rests.half", 2:"rests.quarter", 3:"rests.8th", 4: "rests.16th",5: "rests.32nd", 6: "rests.64th", 7: "rests.128th"},
		   note:{"-1": "noteheads.dbl", 0:"noteheads.whole", 1:"noteheads.half", 2:"noteheads.quarter", 3:"noteheads.quarter", 4:"noteheads.quarter", 5:"noteheads.quarter", 6:"noteheads.quarter"},
		   uflags:{3:"flags.u8th", 4:"flags.u16th", 5:"flags.u32nd", 6:"flags.u64th"},
		   dflags:{3:"flags.d8th", 4:"flags.d16th", 5:"flags.d32nd", 6:"flags.d64th"}};
              
  sortPitch(elem);
  abselem = new ABCAbsoluteElement(elem, duration, 1);
  
  var sum=0
  for (var p=0, pp=elem.pitches.length; p<pp; p++) {
    sum += elem.pitches[p].pitch;
  }

  elem.averagepitch = sum/elem.pitches.length;

  for (var p=0; p<elem.pitches.length; p++) {
    var pitch = elem.pitches[p].pitch;

    var dot=0;
    
    for (var tot = Math.pow(2,durlog), inc=tot/2; tot<duration; dot++,tot+=inc,inc/=2);
    var c = "";
    if (elem.rest_type) {
      pitch = 7;
      switch(elem.rest_type) {
      case "rest": c = chartable["rest"][-durlog]; elem.averagepitch=7; break; // TODO rests in bars is now broken
      case "invisible":
      case "spacer":
	c="";
      }
    } else if (!nostem) {
      var dir = (elem.averagepitch>=6) ? "down": "up";
      if ((dir=="down" && p!=0) || (dir=="up" && p!=pp-1)) { // not the stemmed elem of the chord
	dir = "chord";
      } else {
	var extraflags = true;
      }
      c = chartable["note"][-durlog];
    } else {
      c="noteheads.quarter";
    }
    
    
    
    
    if (c === undefined)
      abselem.addChild(new ABCRelativeElement("chartable[??][" + (-durlog) + '] is undefined', 0, 0, 0, {type:"debug"}));
    else if (c==="") {
      notehead = new ABCRelativeElement(null, 0, 0, pitch);
      abselem.addHead(notehead);
    } else {
      notehead = new ABCRelativeElement(c, 0, this.glyphs.getSymbolWidth(c), pitch);
      abselem.addHead(notehead);
      if (extraflags) {
	var pos = pitch+((dir=="down")?-7:7);
	var flag = chartable[(dir=="down")?"dflags":"uflags"][-durlog]
	var xdelta = (dir=="down")?0:this.glyphs.getSymbolWidth("noteheads.quarter")-0.6;
	abselem.addRight(new ABCRelativeElement(flag, xdelta, this.glyphs.getSymbolWidth(flag), pos));
      }
      for (;dot>0;dot--) {
	var dotadjust = (1-pitch%2); //TODO don't adjust when above or below stave?
	abselem.addRight(new ABCRelativeElement("dots.dot", notehead.w-2+5*dot, this.glyphs.getSymbolWidth("dots.dot"), pitch+dotadjust));
      }
    }

    if (elem.pitches[p].accidental !== undefined && elem.pitches[p].accidental !== 'none') {
      var symb; 
      switch (elem.pitches[p].accidental) {
      case "dbl_sharp":
	symb = "accidentals.dblsharp";
	break;
      case "sharp":
	symb = "accidentals.sharp";
	break;
      case "flat":
	symb = "accidentals.flat";
	break;
      case "dbl_flat":
	symb = "accidentals.dblflat";
	break;
      case "natural":
	symb = "accidentals.nat";
      }
      roomtaken += (this.glyphs.getSymbolWidth(symb)+2);
      abselem.addExtra(new ABCRelativeElement(symb, -roomtaken, this.glyphs.getSymbolWidth(symb), pitch));
    }

    if (elem.pitches[p].endTie) {
      if (this.ties[0]) {
        this.ties[0].anchor2=notehead;
        this.ties = this.ties.slice(1,this.ties.length);
	  }
    }

    if (elem.pitches[p].startTie) {
      var tie = new ABCTieElem(notehead, null, (elem.averagepitch>=6));
      this.ties[this.ties.length]=tie;
      this.staff.addOther(tie);
    }

  }
  
  // draw stem from the furthest note to a pitch above/below the stemmed note
  if (!nostem && durlog<=-1 && !elem.rest_type) {
    var p1 = (elem.averagepitch>=6) ? elem.pitches[0].pitch-7 : elem.pitches[0].pitch+1/3;
    var p2 = (elem.averagepitch>=6) ? elem.pitches[elem.pitches.length-1].pitch-1/3 : elem.pitches[elem.pitches.length-1].pitch+7;
    var dx = (elem.averagepitch>=6)?0:abselem.heads[0].w;
    var width = (elem.averagepitch>=6)?1:-1;
    abselem.addExtra(new ABCRelativeElement(null, dx, 0, p1, {"type": "stem", "pitch2":p2, linewidth: width}));
  }

  
  if (elem.lyric !== undefined) {
	  var lyricStr = "";
	  elem.lyric.each(function(ly) {
		  lyricStr += ly.syllable + ly.divider + "\n";
	  });
    abselem.addChild(new ABCRelativeElement(lyricStr, 0, 0, 0, {type:"debugLow"}));
  }
  
  if (elem.gracenotes !== undefined) {
    for (var i=elem.gracenotes.length-1; i>=0; i--) {
      roomtaken +=10; // hardcoded
      var grace = new ABCRelativeElement("noteheads.quarter", -roomtaken, this.glyphs.getSymbolWidth("noteheads.quarter")/3, elem.gracenotes[i].pitch, {scalex:3/5, scaley: 3/5});
      abselem.addExtra(grace);
      if (i==0) this.staff.addOther(new ABCTieElem(grace, notehead, false));
    }
  }
  
  if (elem.decoration) {
    this.printDecoration(elem.decoration, pitch, (notehead)?notehead.w:0, abselem);
  }

  if (elem.barNumber) {
      abselem.addChild(new ABCRelativeElement(elem.barNumber, -10, 0, 0, {type:"debug"}));
  }

  // ledger lines
  for (i=elem.pitches[elem.pitches.length-1].pitch; i>11; i--) {
    if (i%2===0 && !elem.rest_type) {
      abselem.addChild(new ABCRelativeElement(null, -2, this.glyphs.getSymbolWidth("noteheads.quarter")+4, i, {type:"ledger"}));
    }
  }

  for (i=elem.pitches[0].pitch; i<1; i++) {
    if (i%2===0 && !elem.rest_type) {
      abselem.addChild(new ABCRelativeElement(null, -2, this.glyphs.getSymbolWidth("noteheads.quarter")+4, i, {type:"ledger"}));
    }
  }

  if (elem.chord !== undefined) { //16 -> high E.
    abselem.addChild(new ABCRelativeElement(elem.chord.name, 0, 0, (elem.chord.position=="below")?-3:16, {type:"text"}));
  }

  for (var i=elem.endSlur;i>0;i--) {
    if (this.slurs.length==0) {
      abselem.addChild(new ABCRelativeElement("missing begin slur", 0, 0, 0, {type:"debug"}));
      continue;
    }
    this.slurs[this.slurs.length-1].anchor2=notehead;
    this.slurs = this.slurs.slice(0,this.slurs.length-1);
  }

  for (var i=elem.startSlur;i>0;i--) {
    var slur = new ABCTieElem(notehead, null, (elem.averagepitch>=6));
    this.slurs[this.slurs.length]=slur;
    this.staff.addOther(slur);
  }
  

    


  if (elem.startTriplet) {
    this.triplet = new ABCTripletElem(elem.startTriplet, notehead, null, (elem.averagepitch<6)); // above is opposite from case of slurs
    this.staff.addOther(this.triplet);
  }

  if (elem.endTriplet) {
    this.triplet.anchor2 = notehead;
    this.triplet = null;
  }

  return abselem;
};

ABCPrinter.prototype.printDecoration = function(decoration, pitch, width, abselem) {
  var dec;
  var unknowndecs = [];
  var yslot = (pitch>9) ? pitch+3 : 12;
  var ypos;
  (pitch===5) && (yslot=14); // avoid upstem of the A

  for (var i=0;i<decoration.length; i++) { // treat staccato first (may need to shift other markers) //TODO, same with tenuto?
    if (decoration[i]==="staccato") {
      ypos = (pitch>=6) ? pitch+2:pitch-2;
      (pitch===4) && ypos--; // don't place on a stave line
      ((pitch===6) || (pitch===8)) && ypos++;
      (pitch>9) && yslot++; // take up some room of those that are above
      var deltax = (width-this.glyphs.getSymbolWidth("."))/2;
      abselem.addChild(new ABCRelativeElement("scripts.staccato", deltax, this.glyphs.getSymbolWidth("scripts.staccato"), ypos));
    }
  }

  for (var i=0;i<decoration.length; i++) {
    switch(decoration[i]) {
    case "trill":dec="scripts.trill";break;
    case "roll": dec="scripts.roll"; break;
    case "marcato": dec="scripts.umarcato"; break;
    case "marcato2": dec="scriopts.dmarcato"; break;//other marcato
    case "turn": dec="scripts.turn"; break;
    case "uppermordent": dec="scripts.prall"; break;
    case "mordent":
    case "lowermordent": dec="scripts.mordent"; break;
    case "staccato": continue;
    case "downbow": dec="scripts.downbow";break;
    case "upbow": dec="scripts.upbow";break;
    case "fermata": dec="scripts.ufermata"; break;
    case "invertedfermata": dec="scripts.dfermata"; break;
    case "breath": dec=","; break;
    case "accent": dec="scripts.sforzato"; break;
    case "tenuto": dec="scripts.tenuto"; break;
    case "coda": dec="scripts.coda"; break;
    case "segno": dec="scripts.segno"; break;
    // case "p": dec="p"; break;
    //case "mp": dec="mp"; break;
    //case "ppp": dec="ppp"; break;
    //case "pppp": dec="u"; break;
    //case "f": dec="f"; break;
    //case "ff": dec="\u0192"; break;
    //case "fff": dec="\u00cf"; break;
    //case "ffff": dec="\u00ce"; break;
    //case "sffz": dec="\u00e7"; break;
    //case "mf": dec="F"; break;
    default:
    unknowndecs[unknowndecs.length]=decoration[i];
    continue;
    }
    ypos=yslot;
    yslot+=3;
    var deltax = width/2;
    if (this.glyphs.getSymbolAlign(dec)!=="center") {
      deltax -= (this.glyphs.getSymbolWidth(dec)/2);
    }
    abselem.addChild(new ABCRelativeElement(dec, deltax, this.glyphs.getSymbolWidth(dec), ypos));
  }
  (unknowndecs.length>0) && this.debugMsg(20,unknowndecs.join(','));
}

ABCPrinter.prototype.printBarLine = function (elem) {
// bar_thin, bar_thin_thick, bar_thin_thin, bar_thick_thin, bar_right_repeat, bar_left_repeat, bar_double_repeat

  var abselem = new ABCAbsoluteElement(elem, 0, 10);
  var anchor = null; // place to attach part lines
  var dx = 0;

  var firstdots = (elem.type==="bar_right_repeat" || elem.type==="bar_dbl_repeat");
  var firstthin = (elem.type!="bar_left_repeat" && elem.type!="bar_thick_thin");
  var thick = (elem.type==="bar_right_repeat" || elem.type==="bar_dbl_repeat" || elem.type==="bar_left_repeat" ||
	       elem.type==="bar_thin_thick" || elem.type==="bar_thick_thin");
  var secondthin = (elem.type==="bar_left_repeat" || elem.type==="bar_thick_thin" || elem.type==="bar_thin_thin" || elem.type==="bar_dbl_repeat");
  var seconddots = (elem.type==="bar_left_repeat" || elem.type==="bar_dbl_repeat");

  if (firstdots) {
    abselem.addRight(new ABCRelativeElement("dots.dot", dx, 1, 7));
    abselem.addRight(new ABCRelativeElement("dots.dot", dx, 1, 5));
    dx+=6; //2 hardcoded, twice;
  }

  if (firstthin) {
    anchor = new ABCRelativeElement(null, dx, 1, 2, {"type": "stem", "pitch2":10, linewidth:0.6});
    abselem.addRight(anchor);
    symbscale = 1;
  }

  if (elem.decoration) {
    this.printDecoration(elem.decoration, 12, (thick)?3:1, abselem);
  }

  if (thick) {
    dx+=6; //3 hardcoded;    
    anchor = new ABCRelativeElement(null, dx, 4, 2, {"type": "stem", "pitch2":10, scalex:6, linewidth:0.6});
    abselem.addRight(anchor);
    dx+=4;
  }
  
  if (this.partstartelem && (thick || (firstthin && secondthin))) { // means end of nth part
    this.partstartelem.anchor2=anchor;
    this.partstartelem = null;
  }


  if (secondthin) {
    dx+=3; //3 hardcoded;
    anchor = new ABCRelativeElement(null, dx, 1, 2, {"type": "stem", "pitch2":10, linewidth:0.6});
    abselem.addRight(anchor); // 3 is hardcoded
  }

  if (seconddots) {
    dx+=3; //3 hardcoded;
    abselem.addRight(new ABCRelativeElement("dots.dot", dx, 1, 7));
    abselem.addRight(new ABCRelativeElement("dots.dot", dx, 1, 5));
  } // 2 is hardcoded

  if (elem.ending) {
    this.partstartelem = new ABCEndingElem(elem.ending, anchor, null);
    this.staff.addOther(this.partstartelem);
  } 

  return abselem;	

};

ABCPrinter.prototype.printStave = function (width) {
  this.printStaveLine(0,width,2);
  this.printStaveLine(0,width,4);
  this.printStaveLine(0,width,6);
  this.printStaveLine(0,width,8);
  this.printStaveLine(0,width,10);
  //var staff = this.printSymbol(0, 3, "=", -1, -1); // 3 is hardcoded
  //width = width/(this.glyphs.getSymbolWidth("="));
  //staff.scale(width,1,0);
};

ABCPrinter.prototype.printKeySignature = function(elem) {
  var abselem = new ABCAbsoluteElement(elem,0,10);
  var dx =10;
  abselem.addRight(new ABCRelativeElement("clefs.G", dx, this.glyphs.getSymbolWidth("clefs.G"), 5));
  dx += this.glyphs.getSymbolWidth("clefs.G")+10; // hardcoded
  if (elem.regularKey) {
	  var FLATS = [6,9,5,8,4,7];
	  var SHARPS = [10,7,11,8,5,9];
	  var accidentals = (elem.regularKey.acc !== "sharp") ? FLATS : SHARPS;
	  var number = elem.regularKey.num;
	  var symbol = (elem.regularKey.acc !== "sharp") ? "accidentals.flat" : "accidentals.sharp";
	  for (var i=0; i<number; i++) {
		abselem.addRight(new ABCRelativeElement(symbol, dx, this.glyphs.getSymbolWidth(symbol), accidentals[i]));
		dx += this.glyphs.getSymbolWidth(symbol)+2;
	  }
  }
  if (elem.extraAccidentals) {
	  elem.extraAccidentals.each(function(acc) {
		var symbol = (acc.acc === "sharp") ? "accidentals.sharp" : (acc.acc === "natural") ? "accidentals.nat" : "accidentals.flat";
		var notes = { 'A': 5, 'B': 6, 'C': 0, 'D': 1, 'E': 2, 'F': 3, 'G':4, 'a': 12, 'b': 13, 'c': 7, 'd': 8, 'e': 9, 'f': 10, 'g':11 };
		abselem.addRight(new ABCRelativeElement(symbol, dx, this.glyphs.getSymbolWidth(symbol), notes[acc.note]));
		dx += this.glyphs.getSymbolWidth(symbol)+2;
	  }, this);
  }
  return abselem;
};

ABCPrinter.prototype.printTimeSignature= function(elem) {
  //var timesig = this.currenttune.header.fields["M"];
  //var parts=timesig.match(/([\d]+)\/([\d]+)/);
  var abselem = new ABCAbsoluteElement(elem,0,20);
  if (elem.type === "specified") {
    //TODO make the alignment for time signatures centered
	for (var i = 0; i < elem.value.length; i++) {
	  if (i !== 0)	// TODO-PER: I used '9' where it should be + to make if visible for now.
        abselem.addRight(new ABCRelativeElement('9', i*15-7, this.glyphs.getSymbolWidth(elem.value[i].num[0]), 7));
    abselem.addRight(new ABCRelativeElement(elem.value[i].num.replace('+', '9'), i*15, this.glyphs.getSymbolWidth(elem.value[i].num[0]), 9));
    abselem.addRight(new ABCRelativeElement(elem.value[i].den, i*15, this.glyphs.getSymbolWidth(elem.value[i].den[0]), 5));
	}
  } else if (elem.type === "common_time") {
    abselem.addRight(new ABCRelativeElement("timesig.common", 0, this.glyphs.getSymbolWidth("timesig.common"), 7));

  } else if (elem.type === "cut_time") {
    abselem.addRight(new ABCRelativeElement("timesig.cut", 0, this.glyphs.getSymbolWidth("timesig.cut"), 7));
  }
  return abselem;
};

