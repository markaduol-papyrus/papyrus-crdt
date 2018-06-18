import CRDT from './../lib/crdt.js';

function _getRandomInt() {
  return Math.floor(Math.random() * 1000);
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

/////////////////////////////// ACTUAL TESTS ///////////////////////////////////
describe('Insertion tests (with randomization)', () => {
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

  });

  test('Local insertions of (character -> double newline)', async () => {

  });

  test('Local insertions of (character -> double newline -> character)',
       async () => {

  });
});
