import { DEFAULT_BOUNDARY, DEFAULT_ROOT_LOG_2_BASE } from './defaults.js';
import Char from './char.js';
import Identifier from './identifier.js';

///////////////////// LOGGING, ASSERTIONS AND EXCEPTIONS ///////////////////////

function logWarning(errMsg) {
  console.warn('CRDT: ' + errMsg);
}

function _throwOnConditionFail(cond, errMsg) {
  if (!cond) throw new Error(errMsg || 'An invariant was probably violated.');
}

function _assertIndices(lineIndex, charIndex) {
  let errMsg = `Malformed position indices. Line Index: ${lineIndex}`;
  errMsg += ` Char Index: ${charIndex}`;
  _throwOnConditionFail(lineIndex >= 0 && charIndex >= 0, errMsg);
}

function _assertLineIndex(lineIndex, upperBound) {
  let errMsg = `Line Index: "${lineIndex}" is out of bounds`;
  _throwOnConditionFail(lineIndex >= 0 && lineIndex < upperBound, errMsg);
}

function _assertInterval(lo, hi, minValue) {
  let errMsg = `Interval [${lo}, ${hi}) must have width of at least ${errMsg}`;
  _throwOnConditionFail(hi - lo >= minValue, errMsg);
}

function _assertSingleLinePositions(startPos, endPos) {
  let startPosJSON = JSON.stringify(startPos);
  let endPosJSON = JSON.stringify(endPos);

  let errMsg = `Positions ${startPosJSON} and ${endPosJSON} do not refer to`
  errMsg += ` the same line`;

  const cond1 = endPos.lineIndex === startPos.lineIndex + 1 &&
                startPos.charIndex === 0 && endPos.charIndex === 0;
  const cond2 = startPos.lineIndex === endPos.lineIndex &&
                endPos.charIndex > startPos.charIndex;
  _throwOnConditionFail(cond1 || cond2, errMsg);
}

function CharacterObjectNotFoundException(message) {
  this.name = 'CharacterObjectNotFoundException';
  this.message = message || 'Character not found.'
}
CharacterObjectNotFoundException.prototype = Error.prototype;

function InvalidPositionException(message) {
  this.name = 'InvalidPositionException';
  this.message = message || 'Invalid position';
}
InvalidPositionException.prototype = Error.prototype;

function InvalidDeletionPositionsException(message) {
  this.name = 'InvalidDeletionPositionsException';
  this.message = message || 'Invalid start and end positions for deletion';
}
InvalidDeletionPositionsException.prototype = Error.prototype;


////////////////////////////////////////////////////////////////////////////////

/** CRDT Data Structure */
class CRDT {
  constructor(siteId, rootLog2Base, boundary) {
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
    // Set (unique) site ID
    this.siteId = siteId;
  }

  /** INSERTION/DELETION HANDLERS */

  // TODO: Is there a way to speed up string (i.e. multi-character) insertion
  // with this 2-D array based CRDT data structure?
  /**
   * Insert the given character/value at the given position in the 2-D line
   * array, and return the resulting character object.
   */
  handleLocalInsert(value, position) {
    return new Promise((resolve, reject) => {
      let charObj = this._generateChar(value, position);
      this._insertChar(charObj, position);
      resolve(charObj);
    });
  }

  /**
   * Insert the given character object into the 2-D line array. and then return
   * the the inserted character object and the insertion position as a tuple,
   * in that order.
   */
  handleRemoteInsert(charObj) {
    return new Promise((resolve, reject) => {
      let insertPos = this._findCharObjIndex(charObj);
      this._insertChar(charObj, insertPos);
      resolve([charObj, insertPos]);
    });
  }

  /**
   * Delete character objects starting from the position `startPos` (inclusive)
   * and ending at the position `endPos` (exclusive). Then return an array
   * of the deleted character objects.
   */
  handleLocalDelete(startPos, endPos) {
    return new Promise((resolve, reject) => {
      if (endPos.lineIndex < startPos.lineIndex ||
          startPos.lineIndex === endPos.lineIndex &&
          endPos.charIndex <= startPos.charIndex) {
        let errMsg = `Invalid start position "${startPos}" and end position`;
        errMsg += ` "${endPos}" pair`;
        reject(new InvalidDeletionPositionsException(errMsg));

      } else {

        let deletedChars = [];

        if (endPos.lineIndex > startPos.lineIndex) {
          let indexDifference = endPos.lineIndex - startPos.lineIndex;

          if (indexDifference === 1 &&
              startPos.charIndex === 0 && endPos.charIndex === 0) {
            // Deleting whole single line
            deletedChars = this._deleteSingleLine(startPos, endPos);
          } else {
            // Deleting across multiple lines
            deletedChars = this._deleteMultipleLines(startPos, endPos);
          }
        } else {
          // Deleting part of single line
          deletedChars = this._deleteSingleLine(startPos, endPos);
        }
        resolve(deletedChars);
      }
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
        if (charObj.getValue() === '\n') this._maybeMergeToNextLine(lineIndex);
        // Remove phantom lines
        this._removePhantomLines(lineIndex);
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
    if (pos.lineIndex > this.lineArray.length) {
      let errMsg = `Line index: ${pos.lineIndex} is greater than length of`;
      errMsg += ` line array.`;
      throw new InvalidPositionException(errMsg);
    } else if (pos.lineIndex === this.lineArray.length) {
      // Need to insert on a newline, so push new array
      this.lineArray.push([]);
    }

    // If inserting a newline, split inner array into two new arrays
    if (charObj.getValue() === '\n') {
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
      // Log an error if previous character on the same line is a newline
      // We need no throw an error since this can be rectified by inserting at
      // start of next line
      if (pos.charIndex !== 0 &&
          this.lineArray[pos.lineIndex][pos.charIndex-1].getValue() === '\n')
      {
        let errMsg = 'Warning: Attempting to insert a character into a ';
        errMsg += 'subarray of the line array, but at an index greater than ';
        errMsg += 'that at which a newline character exists.';
        logWarning(errMsg);
        pos.lineIndex += 1;
        pos.charIndex = 0;
        if (pos.lineIndex === this.lineArray.length) {
          this.lineArray.push([]);
        }
      }

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
    return new Char(value, newIdArr);
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
    // Edge case for completely empty line array
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
      let errMsg = `Cannot insert ${charObj} at index ${lo} because ${lo} `;
      errMsg += `is greater than array length: ${this.lineArray.length}`;
      _throwOnConditionFail(lo === this.lineArray.length, errMsg);

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
      if (lo === 0) {
        // We are inserting at absolute beginning of line array
        return {lineIndex: lo, charIndex: 0};
      }
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
    _throwOnConditionFail(value1 <= value2, errMsg);

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
   * Delete characters on a single line, where `startPos` is the position at
   * which to begin the deletion (inclusive) and `endPos` is the position at
   * which to end it (exclusive). Then return the deleted characters.
   */
  _deleteSingleLine(startPos, endPos) {
    _assertSingleLinePositions(startPos, endPos);
    // Edge case when cursor is at top left of editor
    if (startPos.lineIndex === 0 && startPos.charIndex === -1) {
      if (endPos.lineIndex !== 0 || endPos.charIndex !== 0) {
        let errMsg = `Saw startPos "${startPos}" and expected endPos: `;
        errMsg += `{lineIndex: 0, charIndex: 0}. But saw endPos: "${endPos}".`;
        throw new Error(errMsg);
      }
      return [];
    }

    // Number of characters to delete
    let numChars;
    if (startPos.lineIndex === endPos.lineIndex) {
      // Not deleting entire line
      numChars = endPos.charIndex - startPos.charIndex;
    } else {
      // Deleting entire line
      numChars = this.lineArray[startPos.lineIndex].length;
    }
    let deletedChars =
      this.lineArray[startPos.lineIndex].splice(startPos.charIndex, numChars);
    // If whole line was deleted, a phantom line will remain. So if necessary,
    // delete the phantom line and then merge the previous line ot the next
    // line, if necessary.
    this._removePhantomLines(startPos.lineIndex);

    if (startPos.lineIndex < this.lineArray.length) {
      // Attempt to merge to next line if necessary
      let startLine = this.lineArray[startPos.lineIndex];
      if (startLine[startLine.length - 1].getValue() !== '\n') {
        this._maybeMergeToNextLine(startPos.lineIndex);
      }
    } // else: whole line was deleted and it was at the end of the document
      // (line array)

    // Return deleted character objects
    return deletedChars;
  }

  /**
   * Delete characters accross multiple lines, referenced by the indices in
   * the interval [(startPos.lineIndex, startPos.charIndex), (endPos.lineIndex,
   * endPos.charIndex)). Then return the deleted characters.
   */
  _deleteMultipleLines(startPos, endPos) {
    let deletedChars =
      this.lineArray[startPos.lineIndex].splice(startPos.charIndex);

    // Check if endPos exceeds line array length
    if (endPos.lineIndex > this.lineArray.length) {
      logWarning(`End position "${endPos}" is greater than line array ` +
                 `length: "${this.lineArray.length}"`);
      endPos.lineIndex = this.lineArray.length;
    }

    for (let line = startPos.lineIndex + 1; line < endPos.lineIndex; line++) {
      deletedChars = deletedChars.concat(this.lineArray[line].splice(0));
    }

    if (this.lineArray[endPos.lineIndex]) {
      deletedChars = deletedChars.concat(
        this.lineArray[endPos.lineIndex].splice(0, endPos.charIndex)
      );
    }
    // Remove phantom lines and then merge lines if necessary
    this._removePhantomLines(startPos.lineIndex);

    if (startPos.lineIndex < this.lineArray.length) {
      // Attempt to merge to next line, if necessary
      let startLine = this.lineArray[startPos.lineIndex];
      if (startLine[startLine.length - 1].getValue() !== '\n') {
        this._maybeMergeToNextLine(startPos.lineIndex);
      }
    }
    // else: all lines from `startPos.lineIndex` were deleted

    // Return deleted character objects
    return deletedChars;
  }

  /**
   * Remove phantom lines starting at the given line index.
   * NOTE: Phantom lines are distinct from blank lines:
   * the former contain no character objects, whereas the latter contain a
   * single character object with a newline character ('\n').
   */
  _removePhantomLines(line=0) {
    let initialArrayLength = this.lineArray.length;
    while (line < initialArrayLength) {
      if (this.lineArray[line].length === 0) {
        this.lineArray.splice(line, 1);
        line--;
      }
      line++;
      if (line >= this.lineArray.length) return;
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

export default CRDT;
