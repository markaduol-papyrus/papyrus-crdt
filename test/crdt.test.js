import CRDT from './../lib/crdt.js';
import Identifier from './../lib/identifier.js';
import Char from './../lib/char.js';

////////////////////////////// HELPER FUNCTIONS ////////////////////////////////

/**
 * Get random integer in interval [lo, hi)
 */
function _getRandomInt(lo=0, hi=1000) {
  return lo + Math.floor(Math.random() * (hi - lo));
}

function _getRandomChar() {
  return Math.floor(Math.random() * 36).toString(36);
}

function _getRandomCharOrNewline() {
  if (Math.random() < 0.5) return _getRandomChar();
  return '\n';
}

function _getRandomChars(n) {
  let res = [];
  for (let i = 0; i < n; i++) res.push(_getRandomChar());
  return res;
}

function _getRandomIdArray() {
  const [minLength, maxLength] = [1, 10];
  const length = _getRandomInt(minLength, maxLength + 1);
  const siteId = _getRandomInt();

  // `2 ** rootLog2Base` gives branching factor at root of tree
  const [minLog2Base, maxLog2Base] = [1, 10];
  const rootLog2Base = _getRandomInt(minLog2Base, maxLog2Base + 1);

  let idArray = [];
  for (let i = 0; i < length; i++) {
    let value = _getRandomInt(2 ** (rootLog2Base + i));
    let id = new Identifier(value, siteId);
    idArray.push(id);
  }
  return idArray;
}

function _getDistinctIdArrays(n) {
  let idArrays = new Set();
  let i = 0
  while (i < n) {
    let idArr = _getRandomIdArray();
    if (!(idArrays.has(idArr))) {
      idArrays.add(idArr);
      i++;
    }
  }
  return Array.from(idArrays);
}

function _compareIdArrays(idArr1, idArr2) {
  let length1 = idArr1.length;
  let length2 = idArr2.length;
  for (let i = 0; i < Math.min(length1, length2); i++) {
    let comparison = idArr1[i].compareTo(idArr2[i]);
    if (comparison !== 0) return comparison;
  }
  // Break prefix ties on length of ID
  if (length1 < length2) {
    return -1;
  } else if (length1 === length2) {
    return 0;
  } else {
    return 1;
  }
}

function _generateRandomLine(minLength=1, maxLength=100) {
  let charObjArray = [];
  const lineLength = _getRandomInt(minLength, maxLength + 1);

  for (let i = 0; i < lineLength - 1; i++) {
    charObjArray.push(_getRandomChar());
  }
  // New-line char to terminate line
  charObjArray.push('\n');
  return charObjArray;
}

// Constants
const _MIN_LINE_LENGTH = 1;
const _MAX_LINE_LENGTH = 10; // Include '\n' char
// For multi-line documents
const _MIN_LINES_IN_DOC = 2;
const _MAX_LINES_IN_DOC = 10;

/////////////////////////////// ACTUAL TESTS ///////////////////////////////////
describe('Local insertion tests (with randomization)', () => {
  let crdt;

  beforeEach(() => {
    crdt = new CRDT(_getRandomInt());
  });

  // TODO: Might have to write explicit tests testing only for value, since unit
  // tests should only test for one property - such orthogonality amongst tests
  // will simplify debuggging.

  test('Local Insertion at beginning of 2-D array', async () => {
    const randChar = _getRandomChar();
    const pos = {lineIndex: 0, charIndex: 0};
    const charObj = await crdt.handleLocalInsert(randChar, pos);
    // Value check
    expect(charObj.getValue()).toEqual(randChar);
    // Array check
    expect(crdt.lineArray[0][0]).toEqual(charObj);
  });

  test('Local insertions at end of line', async () => {
    const randChars = _getRandomChars(3);
    let charObjs = [];
    for (let i = 0; i < 3; i++) {
      let pos = {lineIndex: 0, charIndex: i};
      charObjs[i] = await crdt.handleLocalInsert(randChars[i], pos);
    }
    // Ordering and Array checks
    for (let i = 0; i < 2; i++) {
      expect(charObjs[i].compareTo(charObjs[i+1])).toEqual(-1);
      expect(crdt.lineArray[0][i]).toEqual(charObjs[i]);
    }
    expect(charObjs[2].getValue()).toEqual(randChars[2]);
  });

  test('Local insertions at middle of line', async () => {
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 0, charIndex: 1};
    const randChars = _getRandomChars(3);
    const charObj1 = await crdt.handleLocalInsert(randChars[0], pos1);
    const charObj2 = await crdt.handleLocalInsert(randChars[1], pos2);
    const charObj3 = await crdt.handleLocalInsert(randChars[2], pos2);
    // Ordering checks
    expect(charObj1.compareTo(charObj2)).toEqual(-1);
    expect(charObj1.compareTo(charObj3)).toEqual(-1);
    expect(charObj2.compareTo(charObj3)).toEqual(1);
    // Array checks
    expect(crdt.lineArray[0][0]).toEqual(charObj1);
    expect(crdt.lineArray[0][1]).toEqual(charObj3);
    expect(crdt.lineArray[0][2]).toEqual(charObj2);
  });

  test('Local insertions at beginning of line', async () => {
    const pos1 = {lineIndex: 0, charIndex: 0};
    const randChars = _getRandomChars(3);
    let charObjs = [];
    for (let i = 0; i < 3; i++) {
      charObjs[i] = await crdt.handleLocalInsert(randChars[i], pos1);
    }
    for (let i = 0; i < 3; i++) {
      if (i < 2) expect(charObjs[i].compareTo(charObjs[i+1])).toEqual(1);
    }
    // Array checks
    expect(crdt.lineArray[0][0]).toEqual(charObjs[2]);
    expect(crdt.lineArray[0][1]).toEqual(charObjs[1]);
    expect(crdt.lineArray[0][2]).toEqual(charObjs[0]);
  });

  test('Local insertions of (character -> newline)', async () => {
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 0, charIndex: 1};
    const randChar = _getRandomChar();
    const charObj1 = await crdt.handleLocalInsert(randChar, pos1);
    const charObj2 = await crdt.handleLocalInsert('\n', pos2);
    // Ordering checks
    expect(charObj1.compareTo(charObj2)).toEqual(-1);
    // Array checks
    expect(crdt.lineArray[0][0]).toEqual(charObj1);
    expect(crdt.lineArray[0][1]).toEqual(charObj2);
  });

  test('Local insertions of (newline -> character)', async () => {
    const pos1 = {lineIndex: 0, charIndex: 0};
    const charObj1 = await crdt.handleLocalInsert('\n', pos1);
    expect(crdt.lineArray[0][0]).toEqual(charObj1);

    const pos2 = {lineIndex: 1, charIndex: 0};
    const randChar = _getRandomChar();
    const charObj2 = await crdt.handleLocalInsert(randChar, pos2);
    // Error should be logged due to insertion after newline char but at end of
    // same subarray
    expect(crdt.lineArray[1][0]).toEqual(charObj2);
  });

  test('Local insertions of (character -> newline -> character)', async () => {
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 0, charIndex: 1};
    const pos3 = {lineIndex: 1, charIndex: 0};
    const randChars = _getRandomChars(2);
    const charObj1 = await crdt.handleLocalInsert(randChars[0], pos1);
    const charObj2 = await crdt.handleLocalInsert('\n', pos2);
    const charObj3 = await crdt.handleLocalInsert(randChars[1], pos3);
    // Ordering checks
    expect(charObj1.compareTo(charObj2)).toEqual(-1);
    expect(charObj2.compareTo(charObj3)).toEqual(-1);
    // Array checks
    expect(crdt.lineArray[0][0]).toEqual(charObj1);
    expect(crdt.lineArray[0][1]).toEqual(charObj2);
    expect(crdt.lineArray[1][0]).toEqual(charObj3);
  });
});

describe('Remote insertion tests (with randomization)', () => {
  let crdt;

  beforeEach(() => {
    crdt = new CRDT(_getRandomInt());
  });

  test('Remote insertion of random character', async () => {
    const idArr = _getRandomIdArray();
    const charObj = new Char(_getRandomChar(), idArr);
    const expectedInsertPos = {lineIndex: 0, charIndex: 0};

    // Get returned character object and position at which insertion occurred.
    let retCharObj, insertPos;
    [retCharObj, insertPos] = await crdt.handleRemoteInsert(charObj);
    // Value check
    expect(charObj).toEqual(retCharObj);
    // Position check
    expect(insertPos).toEqual(expectedInsertPos);
  });

  test('Remote insertion of two characters at end of line', async () => {
    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[1];
      idArrays[1] = idArrays[0];
      idArrays[0] = temp;
    }
    const charObj1 = new Char(_getRandomChar(), idArrays[0]);
    const charObj2 = new Char(_getRandomChar(), idArrays[1]);

    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 0, charIndex: 1};
    expect(insertPos1).toEqual(pos1);
    expect(insertPos2).toEqual(pos2);
  });

  test('Remote insertion of two characters at beginning of line', async () => {
    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[1];
      idArrays[1] = idArrays[0];
      idArrays[0] = temp;
    }
    const charObj1 = new Char(_getRandomChar(), idArrays[0]);
    const charObj2 = new Char(_getRandomChar(), idArrays[1]);

    // Insert character with greater ID array first
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos = {lineIndex: 0, charIndex: 0};
    expect(insertPos1).toEqual(pos);
    expect(insertPos2).toEqual(pos);
  });

  test('Remote insertion of two newlines at end of line', async () => {
    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[1];
      idArrays[1] = idArrays[0];
      idArrays[0] = temp;
    }
    const charObj1 = new Char('\n', idArrays[0]);
    const charObj2 = new Char('\n', idArrays[1]);

    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 1, charIndex: 0}; // since prev. char is newline
    expect(insertPos1).toEqual(pos1);
    expect(insertPos2).toEqual(pos2);
  });

  test('Remote insertion of two newlines at beginning of line', async () => {
    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[1];
      idArrays[1] = idArrays[0];
      idArrays[0] = temp;
    }
    const charObj1 = new Char('\n', idArrays[0]);
    const charObj2 = new Char('\n', idArrays[1]);

    // Insert newline with greater ID array first
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos = {lineIndex: 0, charIndex: 0};
    expect(insertPos1).toEqual(pos);
    expect(insertPos2).toEqual(pos);
  });

  test('Remote insertion of character then newline at end of line',
       async () => {

    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[0];
      idArrays[0] = idArrays[1];
      idArrays[1] = temp;
    }
    const charObj1 = new Char(_getRandomChar(), idArrays[0]);
    const charObj2 = new Char('\n', idArrays[1]);

    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 0, charIndex: 1};
    expect(insertPos1).toEqual(pos1);
    expect(insertPos2).toEqual(pos2);
  });

  test('Remote insertion of newline then character on created line',
       async () => {

    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[0];
      idArrays[0] = idArrays[1];
      idArrays[1] = temp;
    }
    const charObj1 = new Char('\n', idArrays[0]);
    const charObj2 = new Char(_getRandomChar(), idArrays[1]);

    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos1 = {lineIndex: 0, charIndex: 0};
    const pos2 = {lineIndex: 1, charIndex: 0}; // since prev. char is newline
    expect(insertPos1).toEqual(pos1);
    expect(insertPos2).toEqual(pos2);
  });

  test('Remote insertion of newline then character on original line',
       async () => {

    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
    if (compValue > 0) {
      let temp = idArrays[0];
      idArrays[0] = idArrays[1];
      idArrays[1] = temp;
    }
    const charObj1 = new Char('\n', idArrays[1]);
    // Make ID smaller than that of newline character
    const charObj2 = new Char(_getRandomChar(), idArrays[0]);

    let [retCharObj1, insertPos1] = await crdt.handleRemoteInsert(charObj1);
    let [retCharObj2, insertPos2] = await crdt.handleRemoteInsert(charObj2);
    // Value check
    expect(charObj1).toEqual(retCharObj1);
    expect(charObj2).toEqual(retCharObj2);
    // Position check
    const pos = {lineIndex: 0, charIndex: 0};
    expect(insertPos1).toEqual(pos);
    expect(insertPos2).toEqual(pos);
  });
});

describe('Local deletion - Single line - with randomization', () => {
  let crdt;

  beforeEach(() => {
    crdt = new CRDT(_getRandomInt());
  });

  test('Single character insertion then deletion', async () => {
    const randChar = _getRandomChar();
    const pos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: 0, charIndex: 1};
    const charObj = await crdt.handleLocalInsert(randChar, pos);
    expect(crdt.lineArray[0][0]).toEqual(charObj);
    const delChars = await crdt.handleLocalDelete(pos, endPos);
    expect(delChars[0]).toEqual(charObj);
    expect(crdt.lineArray.length === 0);
  });

  test('Deletion of first character in line', async () => {
    // Create random line
    const lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

    // Insert chars
    for (let i = 0; i < lineChars.length; i++) {
      let pos = {lineIndex: 0, charIndex: i};
      await crdt.handleLocalInsert(lineChars[i], pos);
    }

    // Get expected char
    const expectedChar = Object.assign({}, crdt.lineArray[0][0]);

    // Delete char
    const startPos = {lineIndex: 0, charIndex: 0};
    let endPos;

    // Check if line consists of a single newline character
    if (lineChars.length === 1 && lineChars[0] === '\n') {
      endPos = {lineIndex: 1, charIndex: 0};
    } else {
      endPos = {lineIndex: 0, charIndex: 1}
    }
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars[0]).toEqual(expectedChar);
    expect(crdt.lineArray[0].length).toEqual(lineChars.length - 1);
  });

  test('Deletion of middle character in line', async () => {
    const [minLength, maxLength] = [4, 100];
    const lineChars = _generateRandomLine(minLength, maxLength);

    // Insert chars
    for (let i = 0; i < lineChars.length; i++) {
      let pos = {lineIndex: 0, charIndex: i};
      await crdt.handleLocalInsert(lineChars[i], pos);
    }

    // Get expected char
    const randIndex = _getRandomInt(1, lineChars.length - 1);
    const expectedChar = Object.assign({}, crdt.lineArray[0][randIndex]);

    // Delete char
    const startPos = {lineIndex: 0, charIndex: randIndex};
    const endPos = {lineIndex: 0, charIndex: randIndex + 1};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars[0]).toEqual(expectedChar);
    expect(crdt.lineArray[0].length).toEqual(lineChars.length - 1);
  });

  test('Deletion of last character in line', async () => {
    const lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

    // Insert chars
    for (let i = 0; i < lineChars.length; i++) {
      let pos = {lineIndex: 0, charIndex: i};
      await crdt.handleLocalInsert(lineChars[i], pos);
    }

    // Get expected char
    const expectedChar = Object.assign(
      {}, crdt.lineArray[0][crdt.lineArray[0].length - 1]
    );

    // Delete char
    const startPos = {lineIndex: 0, charIndex: lineChars.length - 1};
    let endPos;

    if (lineChars.length === 1 && lineChars[0] === '\n') {
      endPos = {lineIndex: 1, charIndex: 0};
    } else {
      endPos = {lineIndex: 0, charIndex: lineChars.length};
    }
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars[0]).toEqual(expectedChar);
    expect(crdt.lineArray[0].length).toEqual(lineChars.length - 1);
  });

  test('Deletion of single line in a single line document', async () => {
    const lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

    // Insert chars
    for (let i = 0; i < lineChars.length; i++) {
      let pos = {lineIndex: 0, charIndex: i};
      await crdt.handleLocalInsert(lineChars[i], pos);
    }

    // Get expected line
    const expectedLine = Object.assign([], crdt.lineArray[0]);

    // Delete char
    const startPos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: 1, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedLine);
    expect(crdt.lineArray.length).toEqual(0);
  });

  test('Deletion of a entire line at start of document in multi-line document',
       async () => {
    const docLength = _getRandomInt(_MIN_LINES_IN_DOC, _MAX_LINES_IN_DOC + 1);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected line
    const expectedLine = Object.assign([], crdt.lineArray[0]);

    // Delete line
    const startPos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: 1, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedLine);
    expect(crdt.lineArray.length).toEqual(docLength - 1);
  });

  test('Deletion of entire line in middle of document in mutli-line document',
       async () => {
    const docLength = _getRandomInt(3, 5);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected line
    const midIndex = _getRandomInt(1, docLength - 1);
    const expectedLine = Object.assign([], crdt.lineArray[midIndex]);

    // Delete line
    const startPos = {lineIndex: midIndex, charIndex: 0};
    const endPos = {lineIndex: midIndex + 1, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedLine);
    expect(crdt.lineArray.length).toEqual(docLength - 1);
  });

  test('Deletion of entire line at end of document in multi-line document',
       async () => {
    const docLength = _getRandomInt(_MIN_LINES_IN_DOC, _MAX_LINES_IN_DOC + 1);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected line
    const expectedLine = Object.assign(
      [], crdt.lineArray[crdt.lineArray.length - 1]
    );

    // Delete line
    const startPos = {lineIndex: docLength - 1, charIndex: 0};
    const endPos = {lineIndex: docLength, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedLine);
    expect(crdt.lineArray.length).toEqual(docLength - 1);
  });

  // TODO: Split the next test cases into the following groupings
  // Full-Full, Full-Partial, Partial-Full, Partial-Partial
  // First-Last, Mid-Mid, First-Mid, Mid-Last
  // Thus, 4 x 4 = 16 test cases in total

});

let describeMsg = 'Local deletion - Multiple lines - Full line to full line';
describeMsg += ' - with randomization';

describe(describeMsg, () => {
  // CRDT
  let crdt;

  beforeEach(() => {
    crdt = new CRDT(_getRandomInt());
  });

  test('Deletion from first to last line of document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected chars
    let expectedChars = [];
    for (let i = 0; i < crdt.lineArray.length; i++) {
      expectedChars =
        expectedChars.concat(Object.assign([], crdt.lineArray[i]));
    }

    // Delete all lines (fully) from start line to last line
    const startPos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: docLength, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(0);
  });

  test('Deletion from first to middle line in document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected chars
    const midIndex = _getRandomInt(1, docLength - 1);
    let expectedChars = [];
    for (let i = 0; i < midIndex + 1; i++) {
      expectedChars =
        expectedChars.concat(Object.assign([], crdt.lineArray[i]));
    }

    // Delete all lines (fully) from start line to middle line
    const startPos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: midIndex + 1, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(docLength - midIndex - 1);
  });

  test('Deletion from middle to last line of document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected chars
    const midIndex = _getRandomInt(1, docLength - 1);
    let expectedChars = [];
    for (let i = midIndex; i < docLength; i++) {
      expectedChars =
        expectedChars.concat(Object.assign([], crdt.lineArray[i]));
    }

    // Delete all lines (fully) from middle line to last line
    const startPos = {lineIndex: midIndex, charIndex: 0};
    const endPos = {lineIndex: docLength, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(midIndex);
  });

  test('Deletion from middle to middle line in document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get expected chars
    const midIndex1 = _getRandomInt(1, docLength - 2);
    const midIndex2 = midIndex1 + 3;

    let expectedChars = [];
    for (let i = midIndex1; i < midIndex2; i++) {
      expectedChars =
        expectedChars.concat(Object.assign([], crdt.lineArray[i]));
    }

    // Delete lines
    const startPos = {lineIndex: midIndex1, charIndex: 0};
    const endPos = {lineIndex: midIndex2, charIndex: 0};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    const expectedLength = docLength - (midIndex2 - midIndex1);
    expect(crdt.lineArray.length).toEqual(expectedLength);
  });
});

describeMsg = 'Local deletion - Multiple lines - Full line to partial line';
describeMsg += ' - with randomization';

describe(describeMsg, () => {
  // CRDT
  let crdt;

  beforeEach(() => {
    crdt = new CRDT(_getRandomInt());
  });

  test('Deletion from first to last line in document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get random char index for partial line
    const randCharIndex =
      _getRandomInt(0, crdt.lineArray[docLength - 1].length);

    // Get expected chars
    let expectedChars = [];

    for (let i = 0; i < crdt.lineArray.length; i++) {
      let lineChars;

      if (i === crdt.lineArray.length - 1) {
        // Get only partial line
        lineChars =
          Object.assign([], crdt.lineArray[i].slice(0, randCharIndex));
      } else {
        lineChars = Object.assign([], crdt.lineArray[i]);
      }

      expectedChars = expectedChars.concat(lineChars);
    }

    // Delete all lines from full start line to partial last line
    const startPos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: docLength - 1, charIndex: randCharIndex};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(1);
  });

  test('Deletion from first to middle line in document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get index for line in middle of document
    const midIndex = _getRandomInt(1, docLength - 1);
    // Get random char index for partial line
    const randCharIndex = _getRandomInt(0, crdt.lineArray[midIndex].length);

    // Get expected chars
    let expectedChars = [];
    for (let i = 0; i < midIndex + 1; i++) {
      let lineChars;

      if (i === midIndex) {
        // Get only partial line
        lineChars =
          Object.assign([], crdt.lineArray[i].slice(0, randCharIndex));
      } else {
        lineChars = Object.assign([], crdt.lineArray[i]);
      }

      expectedChars = expectedChars.concat(lineChars);
    }

    // Delete all lines from full start line to partial middle line
    const startPos = {lineIndex: 0, charIndex: 0};
    const endPos = {lineIndex: midIndex, charIndex: randCharIndex};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(docLength - midIndex);
  });

  test('Deletion from middle to last line in document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get index for line in middle of document
    const midIndex = _getRandomInt(1, docLength - 1);
    // Get random char index for partial line
    const randCharIndex =
      _getRandomInt(0, crdt.lineArray[docLength - 1].length);

    // Get expected chars
    let expectedChars = [];
    for (let i = midIndex; i < docLength; i++) {
      let lineChars;

      if (i === docLength - 1) {
        // Get only partial line
        lineChars =
          Object.assign([], crdt.lineArray[i].slice(0, randCharIndex));
      } else {
        lineChars = Object.assign([], crdt.lineArray[i]);
      }

      expectedChars = expectedChars.concat(lineChars);
    }

    // Delete all lines from middle line to partial last line
    const startPos = {lineIndex: midIndex, charIndex: 0};
    const endPos = {lineIndex: docLength - 1, charIndex: randCharIndex};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(midIndex + 1);
  });

  test('Deletion from middle to middle line in document', async () => {
    // Set document length and insert lines into document
    const docLength = _getRandomInt(3, 101);

    // Insert lines into doc
    for (let i = 0; i < docLength; i++) {
      let lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

      let pos;
      for (let j = 0; j < lineChars.length; j++) {
        pos = {lineIndex: i, charIndex: j};
        await crdt.handleLocalInsert(lineChars[j], pos);
      }
    }

    // Get index for line in middle of document
    const midIndex1 = _getRandomInt(1, docLength - 2);
    const midIndex2 = midIndex1 + 1;
    // Get random char index for partial line
    const randCharIndex =
      _getRandomInt(0, crdt.lineArray[midIndex2].length);

    // Get expected chars
    let expectedChars = [];
    for (let i = midIndex1; i < midIndex2 + 1; i++) {
      let lineChars;

      if (i === midIndex2) {
        // Get only partial line
        lineChars =
          Object.assign([], crdt.lineArray[i].slice(0, randCharIndex));
      } else {
        lineChars = Object.assign([], crdt.lineArray[i]);
      }

      expectedChars = expectedChars.concat(lineChars);
    }

    // Delete all lines from middle line to partial last line
    const startPos = {lineIndex: midIndex1, charIndex: 0};
    const endPos = {lineIndex: midIndex2, charIndex: randCharIndex};
    const delChars = await crdt.handleLocalDelete(startPos, endPos);

    // Test
    expect(delChars).toEqual(expectedChars);
    expect(crdt.lineArray.length).toEqual(docLength - (midIndex2 - midIndex1));
  });
});
/*
describeMsg = 'Local deletion - Multiple lines - Partial line to full line';
describeMsg += ' - with randomization';

describe(describeMsg, () => {

  test('Deletion of first and last line in document', async () => {

  });

  test('Deletion of first and middle line in document', async () => {

  });

  test('Deletion of middle and last line in document', async () => {

  });

  test('Deletion of two distinct middle lines in document', async () => {

  });
});

describeMsg = 'Local deletion - Multiple lines - Partial line to partial line';
describeMsg += ' - with randomization';

describe(describeMsg, () => {

  test('Deletion of first and last line in document', async () => {

  });

  test('Deletion of first and middle line in document', async () => {

  });

  test('Deletion of middle and last line in document', async () => {

  });

  test('Deletion of two distinct middle lines in document', async () => {

  });
});
*/
