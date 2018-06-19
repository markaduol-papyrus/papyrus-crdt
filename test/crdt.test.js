import CRDT from './../lib/crdt.js';
import Identifier from './../lib/identifier.js';
import Char from './../lib/char.js';

////////////////////////////// HELPER FUNCTIONS ////////////////////////////////

/**
 * Get random integer in interval [0, hi)
 */
function _getRandomInt(minValue=0, maxValue=1000) {
  return minValue + Math.floor(Math.random() * maxValue);
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

  let idArrays = _getDistinctIdArrays(lineLength);
  // Sort in-place
  idArrays.sort(_compareIdArrays);

  let charObj;
  for (let i = 0; i < lineLength - 1; i++) {
    charObj = new Char(_getRandomChar(), idArrays[i]);
    charObjArray.push(charObj);
  }
  // New-line char to terminate line
  charObj = new Char('\n', idArrays[lineLength - 1]);
  charObjArray.push(charObj);

  return charObjArray;
}

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

  test('Remote insertion of (character -> character)', async () => {
    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
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
    if (compValue < 0) {
      expect(insertPos1).toEqual(pos1);
      expect(insertPos2).toEqual(pos2);
    } else {
      expect(insertPos1).toEqual(pos2);
      expect(insertPos2).toEqual(pos1);
    }
  });

  test('Remote insertion of (newline -> newline)', async () => {
    const idArrays = _getDistinctIdArrays(2);
    const compValue = _compareIdArrays(idArrays[0], idArrays[1]);
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
    if (compValue < 0) {
      expect(insertPos1).toEqual(pos1);
      expect(insertPos2).toEqual(pos2);
    } else {
      expect(insertPos1).toEqual(pos2);
      expect(insertPos2).toEqual(pos1);
    }
  });

  test('Remote insertion of (character -> newline)', async () => {
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

  test('Remote insertion of (newline -> character)', async () => {
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
});

describe('Local deletion tests (with randomization)', () => {
  let crdt;
  const _MIN_LINE_LENGTH = 1;
  const _MAX_LINE_LENGTH = 100; // Include '\n' char

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

    // Delete char
    const pos = {lineIndex: 0, charIndex: 0};
    let endPos;

    if (lineChars.length === 1 && lineChars[0].getValue() === '\n') {
      endPos = {lineIndex: 1, charIndex: 0};
    } else {
      endPos = {lineIndex: 0, charIndex: 1}
    }
    const delChars = await crdt.handleLocalDelete(pos, endPos);

    // Test
    expect(delChars[0]).toEqual(lineChars[0]);
    expect(crdt.lineArray[0].length).toEqual(lineChars.length - 1);
  });

  test('Deletion of middle character in line', async () => {
    const [minLength, maxLength] = [4, 100];
    const lineChars = _generateRandomLine(_MIN_LINE_LENGTH, _MAX_LINE_LENGTH);

    // Insert chars
    for (let i = 0; i < lineChars.length; i++) {
      let pos = {lineIndex: 0, charIndex: i};
      await crdt.handleLocalInsert(lineChars[i], pos);
    }

    // Delete char
    const randIndex = _getRandomInt(1, lineChars.length - 1);
    const pos = {lineIndex: 0, charIndex: randIndex};
    const endPos = {lineIndex: 0, charIndex: randIndex + 1};
    const delChars = await crdt.handleLocalDelete(pos, endPos);

    // Test
    expect(delChars[0]).toEqual(lineChars[randIndex]);
    expect(crdt.lineArray[0].length).toEqual(lineChars.length - 1);
  });

  test('Deletion of last character in line', async () => {

  });

  test('Deletion of entire line at start of document', async () => {

  });

  test('Deletion of entire line at end of document', async () => {

  });

  test('Deletion of entire line in middle of document', async () => {

  });

  // TODO: Split the next test cases into the following groupings
  // Full-Full, Full-Partial, Partial-Full, Partial-Partial
  // First-Last, Mid-Mid, First-Mid, Mid-Last
  // Thus, 4 x 4 = 16 test cases in total

  test('Deletion of multiple lines starting with full first line of document',
       async () => {

  });

  test('Deletion of multiple lines starting with partial first line of ' +
       'document', async () => {

  });

  test('Deletion of multiple lines ending with full last line of document',
       async () => {

  });

  test('Deletion of multiple lines ending with partial last line of ' +
       'document', async () => {

  });

  test('Deletion of all lines in document', async() => {

  });
});

describe('Remote deletion tests (with randomization)', () => {

});
