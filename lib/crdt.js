import { DEFAULT_BOUNDARY, DEFAULT_ROOT_LOG_2_BASE } from './defaults.js';
import Char from './char.js';
import Identifier from './identifier.js';

///////////////////////// ASSERTIONS AND EXCEPTIONS ////////////////////////////

function _assertIndices(lineIndex, charIndex) {
  let errMsg = `Malformed position indices. Line Index: ${lineIndex}`;
  errMsg += ` Char Index: ${charIndex}`;
  console.assert(lineIndex >= 0 && charIndex >= 0, errMsg);
}

function _assertLineIndex(lineIndex, upperBound) {
  let errMsg = `Line Index: "${lineIndex}" is out of bounds`;
  console.assert(lineIndex >= 0 && lineIndex < upperBound, errMsg);
}

function _assertInterval(lo, hi, minValue) {
  let errMsg = `Interval [${lo}, ${hi}) must have width of at least ${errMsg}`;
  console.assert(hi - lo >= minValue, errMsg);
}

function _assertSingleLinePositions(startPos, endPos) {
  let errMsg = `Positions ${startPos} and ${endPos} do not refer to the same`;
  errMsg += `line`;
  console.assert(errMsg)
}

function CharacterObjectNotFoundException(message) {
  this.name = 'CharacterObjectNotFoundException';
  this.message = message || 'Character not found.'
}
CharacterObjectNotFoundException.prototype = Error.prototype;


////////////////////////////////////////////////////////////////////////////////

/** CRDT Data Structure */
class CRDT {
  constructor(controller, rootLog2Base, boundary) {
    // 2-D array storing character information by line.
    this.lineArray = [];
    // 2 ** (rootLog2Base) gives the branching at level 0 of the exponential
    // tree determined by the total ordering of characters.
    this.rootLog2Base = rootLog2Base || DEFAULT_ROOT_LOG_2_BASE;
    // Boundary value in used during identifier allocation. A higher value is
    // optimal in situations where we expect edits to occur in a narrow
    // neighbourhood of text positions, and a lower value is optimal where we
    // expect edits to occur in a broad neighbourhood of text positions.
    // TODO: Consider dynamically adapting boundary value based on user
    // behaviour.
    this.boundary = boundary || DEFAULT_BOUNDARY;
    // Set site ID to that of higher-level controller
    this.siteId = controller.getSiteId();
  }

  /** INSERTION/DELETION HANDLERS */

  /**
   * Insert the given character/value at the given position in the 2-D line
   * array, and return the resulting character object.
   */
  handleLocalInsert(value, position) {
    return new Promise((resolve, reject) => {
      let charObj = this.this._generateChar(value, position);
      this._insertChar(charObj, position);
      resolve(charObj);
    });
  }

  /**
   * Insert the given character object into the 2-D line array. and then return
   * the value of the inserted character and the insertion position.
   */
  handleRemoteInsert(charObj) {
    return new Promise((resolve, reject) => {
      let insertPos = this._findCharObjIndex(charObj);
      this._insertChar(charObj, insertPos);
      resolve(charObj, insertPos);
    });
  }

  /**
   * Delete character objects starting from the position `startPos` (inclusive)
   * and ending at the position `endPos` (exclusive). Then return the deleted
   * character objects.
   */
  handleLocalDelete(startPos, endPos) {
    return new Promise((resolve, reject) => {
      let deletedChars = [];
      if (startPos.lineIndex !== endPos.lineIndex) {
        deletedChars = this._deleteMultipleLines(startPos, endPos);
      } else {
        deletedChars = this._deleteSingleLine(startPos, endPos);
      }
      resolve(deletedChars);
    });
  }

  /**
   * Delete the given character object from the 2-D line array, if it exists.
   * If the character object was deleted, return the position of deletion,
   * otherwise return an error.
   */
  handleRemoteDelete(charObj) {
    return new Promise((resolve, reject) => {
      let deletePos = this._findCharObjIndex(charObj);
      let lineIndex = deletePos.lineIndex;
      let charIndex = deletePos.charIndex;

      // Check whether character exists
      if (this.lineArray[lineIndex][charIndex].compareTo(charObj) !== 0) {
        let errMsg = `Character object "${charObj}" not found in line array.`;
        reject(CharacterObjectNotFoundException(errMsg));
      } else {
        // Remove character from line array
        this.lineArray[lineIndex].splice(charIndex, 1);
        // Handle case for deletion of newline character
        if (charObj.getVaule() === '\n') this._maybeMergeToNextLine(lineIndex);
        // Remove phantom lines
        this._removePhantomLines();
        resolve(deletePos);
      }
    });
  }

  /** PRIVATE HELPERS FOR INSERTION/DELETION */

  /**
   * Insert the given character object at the given position in the 2-D line
   * array (also handling the sp. case when the character value is a newline).
   */
  _insertChar(charObj, pos) {
    if (pos.lineIndex === this.lineArray.length) {
      // Need to insert on a newline, so push new array
      this.lineArray.push([]);
    }

    // If inserting a newline, split inner array into two new arrays
    if (charObj.getVaule() === '\n') {
      let charsFromIndex = this.lineArray[pos.lineIndex].splice(pos.charIndex);

      if (charsFromIndex.length === 0) {
        this.lineArray[pos.lineIndex].splice(pos.charIndex, 0, charObj);
      } else {
        // Get characters in interval [0, pos.charIndex)
        let charsBeforeIndex =
          this.lineArray[pos.lineIndex].slice(0, pos.charIndex);
        // Concat newline char to chars before insertion index
        charsBeforeIndex = charsBeforeIndex.concat(charObj);
        // Split line into two lines
        this.lineArray.splice(
          pos.lineIndex, 1, charsBeforeIndex, charsFromIndex
        );
      }
    } else {
      // Insert at index at relevant line
      this.lineArray[pos.lineIndex].splice(pos.charIndex, 0, charObj);
    }
  }

  /**
   * PRE (1): 0 <= pos.lineIndex < this.lineArray.length
   * PRE (2): 0 <= pos.charIndex <= this.lineArray[pos.lineIndex].length
   * Get the identifier array of the character object that precedes the given
   * position.
   */
  _getIdArrayBeforePosition(pos) {
    let lineIndex = pos.lineIndex;
    let charIndex = pos.charIndex;
    _assertIndices(lineIndex, charIndex);

    if (lineIndex === 0 && charIndex === 0) {
      return [];
    } else if (lineIndex > 0 && charIndex === 0) {
      lineIndex -= 1;
      charIndex = this.lineArray[lineIndex].length;
    }
    return this.lineArray[lineIndex][charIndex - 1].getIdArray();
  }

  /**
   * if (this.lineArray.length !== 0)
   *   PRE (1): 0 <= pos.lineIndex < this.lineArray.length
   *   PRE (2): 0 <= pos.charIndex <= this.lineArray[pos.lineIndex].length
   * Get the identifier array of the character object at the given position.
   */
  _getIdArrayAtPosition(pos) {
    let lineIndex = pos.lineIndex;
    let charIndex = pos.charIndex;
    _assertIndices(lineIndex, charIndex);

    // Special case
    if (this.lineArray.length === 0) return [];

    // It is possible we may have `line === this.lineArray.length`. This will
    // occur when we are inserting at the first position in a blank editor.
    if (lineIndex === this.lineArray.length ||
         (lineIndex === this.lineArray.length - 1 &&
         charIndex === this.lineArray[lineIndex].length)
       )
    {
      return [];
    } else if (charIndex === this.lineArray[lineIndex].length) {
      lineIndex += 1;
      charIndex = 0;
    }
    return this.lineArray[lineIndex][charIndex].getIdArray();
  }

  /**
   * Generate an character object from the given value and position (line and
   * character index into the line array).
   */
  _generateChar(value, pos) {
    let loIdArr = this._getIdArrayBeforePosition(pos);
    let hiIdArr = this._getIdArrayAtPosition(pos);
    let newIdArr = this._generateIdArrayBetween(loIdArr, hiIdArr);
    return new Char(value, this.siteId, newIdArr);
  }

  /**
   * Find and return the index of the given character object within the line at
   * the given index.
   */
  _findCharObjIndexInLine(charObj, lineIndex) {
    _assertLineIndex(lineIndex, this.lineArray.length);
    // Left-biased binary search
    let lo = 0;
    let hi = this.lineArray.length
    let mid;
    let currentCharObj;

    while (lo < hi) {
      mid = Math.floor((lo + hi) / 2);
      currentCharObj = this.lineArray[lineIndex][mid];
      if (currentCharObj.compareTo(charObj) < 0) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    return lo;
  }

  /**
   * Find and return the line and character indices of the given character
   * object.
   */
  _findCharObjIndex(charObj) {
    // Edge case
    if (this.lineArray.length === 0) return {lineIndex: 0, charIndex: 0};

    // Left-biased binary search
    let lo = 0;
    let hi = this.lineArray.length;
    while (lo < hi) {
      let mid = Math.floor((lo + hi) / 2);
      let curLine = this.lineArray[mid];
      let lastChar = curLine[curLine.length - 1];

      // Characters shoudl be totally ordered and if comparison === 0, then
      // the `charObj` is being deleted
      if (charObj.compareTo(lastChar) <= 0) {
        hi = mid;
      } else {
        lo = mid + 1;
      }
    }

    // Case: Character ID is greater than all others.
    if (lo >= this.lineArray.length) {
      console.assert(lo === this.lineArray.length);

      let lastLine = this.lineArray[this.lineArray.length - 1];
      let lastChar = lastLine[lastLine.length - 1];

      if (lastChar.getValue() === '\n') {
        // Insert character on next line
        return {lineIndex: lo, charIndex: 0};
      } else {
        // Insert character at end of last line
        return {lineIndex: lo - 1, charIndex: lastLine.length};
      }
    }

    // Case: Character ID is not greater than all others.
    // Get index at which to insert character in given line
    let charIndex = this._findCharObjIndexInLine(charObj, lo);
    if (charIndex === 0) {
      // Need to know whether to insert at end of a line `lo-1` or beginning
      // of line `lo`
      let prevLine = this.lineArray[lo - 1];
      let lastChar = prevLine[prevLine.length - 1];

      if (lastChar.getValue() === '\n') {
        // Insert at beginning of line `lo`
        return {lineIndex: lo, charIndex: 0};
      } else {
        // Insert at end of line `lo-1`
        return {lineIndex: lo - 1, charIndex: prevLine.length};
      }
    }

    return {lineIndex: lo, charIndex: charIndex};
  }

  /**
   * Generate a random integer in the interval [lo, hi)
   */
  _generateIntBetween(lo, hi) {
    _assertInterval(lo, hi, 1);
    let interval = Math.min(this.boundary, hi - lo);
    // Math.random() generates a value in the interval [0, 1)
    return Math.floor(Math.random() * interval) + lo;
  }

  /**
   * Generate a new ID array such that `loIdArr < newIdArr < hiIdArr` according
   * to the defined total order on ID arrays.
   */
  _generateIdArrayBetween(loIdArr, hiIdArr, newIdArr=[], depth=0) {
    let log2Base = this.rootLog2Base + depth;

    // Get the path of both IDs at the current depth
    let id1;
    if (loIdArr === undefined || loIdArr.length === 0) {
      id1 = new Identifier(0, this.siteId);
    } else {
      id1 = loIdArr[0];
    }

    let id2;
    if (hiIdArr === undefined || hiIdArr.length === 0) {
      id2 = new Identifier(Math.pow(2, log2Base), this.siteId);
    } else {
      id2 = hiIdArr[0];
    }

    // Get values of IDs at the current depth
    let value1 = id1.getValue();
    let value2 = id2.getValue();
    let errMsg = `Invalid total ordering on IDs: ${id1} and ${id2}.`;
    errMsg += ' Expected former to precede latter';
    console.assert(value1 <= value2, errMsg);

    if (value2 - value1 > 1) {
      // We can generate a new ID inbetween the two boundary IDs
      let newValue = this._generateIntBetween(value1 + 1, value2);
      newIdArr.push(new Identifier(newValue, this.siteId));
      return newIdArr;
    } else if (value2 - value1 === 1) {
      newIdArr.push(id1);

      return this._generateIdArrayBetween(
        loIdArr.slice(1), [], newIdArr, depth + 1
      );
    } else if (id1.getSiteId() === id2.getSiteId()) {
      // Don't think this case should ever occur, but handling just in case
      newIdArr.push(id1);
      return this._generateIdArrayBetween(
        loIdArr.slice(1), hiIdArr.slice(1), newIdArr, depth + 1
      );
    } else {
      let errMsg = `IDs: ${loIdArr} and ${hiIdArr} not ordered as expected.`;
      throw new Error(errMsg);
    }
  }

  /**
   * Delete characters on a single line, referenced by the indices in the
   * interval [startPos.charIndex, endPos.charIndex)
   */
  _deleteSingleLine(startPos, endPos) {
    _assertSingleLinePositions(startPos, endPos);
    let numChars = endPos.charIndex - startPos.charIndex;
    let deletedChars =
      this.lineArray[startPos.line].splice(startPos.charIndex, numChars);
    return deletedChars;
  }

  /**
   * Delete characters accross multiple lines, referenced by the indices in
   * the interval [(startPos.lineIndex, startPos.charIndex), (endPos.lineIndex,
   * endPos.charIndex))
   */
  _deleteMultipleLines(startPos, endPos) {
    let deletedChars = this.lineArray[startPos.line].splice(startPos.charIndex);
    for (let line = startPos.line; lin < endPos.line; line++) {
      deletedChars = deletedChars.concat(this.lineArray[line].splice(0));
    }
    if (this.lineArray[endPos.lineIndex]) {
      deletedChars = deletedChars.concat(
        this.lineArray[endPos.lineIndex].splice(0, endPos.charIndex)
      );
    }
  }

  /**
   * Remove phantom lines. NOTE: Phantom lines are distinct from blank lines:
   * the former contain no character objects, the latter contain a single
   * character object with a newline character ('\n').
   */
  _removePhantomLines() {
    let line = 0;
    while (line < this.lineArray.length) {
      if (this.lineArray[line].length === 0) {
        this.lineArray.splice(line, 1);
        line--;
      }
      line++;
    }
  }

  /**
   * If possible, merge the line indexed by `line` to the next line in the line
   * array.
   */
  _maybeMergeToNextLine(line) {
    if (line < this.lineArray.length - 1) {
      let mergedLine = this.lineArray[line].concat(this.lineArray[line + 1]);
      this.lineArray.splice(line, 2, mergedLine);
    }
  }
}
