////////////////////////// ASSERTIONS AND EXCEPTIONS ///////////////////////////

function InconsistentSiteIdsException(message) {
  this.name = 'InconsistentSiteIdsException';
  this.message = message || 'Inconsistent Site IDs';
}
InconsistentSiteIdsException.prototype = Error.prototype;

/**
 * Verfiy that the site IDs of all Identifiers in the ID array are the same.
 */
function _assertConsistentSiteIds(idArray) {
  let siteId = idArray[0].getSiteId();
  let errMsg = `Inconsistent site IDs in identifier array ${idArray}`;
  for (let i = 1; i < idArray.length; i++) {
    if (idArray[i].getSiteId() !== siteId) {
      throw new InconsistentSiteIdsException(errMsg);
    }
  }
}

////////////////////////////////////////////////////////////////////////////////

class Char {
  constructor(value, idArray, validateSiteIds=false) {
    if (!(Array.isArray(idArray))) {
      throw new TypeError(`${idArray} is not a valid array`);
    }
    if (idArray.length === 0) {
      throw new Error('Identifier array cannot be empty');
    }
    // NOTE: Assertion could be expensive due to iterating over whole array.
    if (validateSiteIds) _assertConsistentSiteIds(idArray);
    this.value = value;
    this.siteId = idArray[0].getSiteId();
    this.idArray = idArray;
  }

  getValue() {
    return this.value;
  }

  getSiteId() {
    return this.siteId;
  }

  getIdArray() {
    return this.idArray;
  }

  compareTo(other) {
    if (!(other instanceof Char)) {
      throw new TypeError(`${other} is not an instance of Char`);
    }
    let length1 = this.idArray.length;
    let length2 = other.idArray.length;

    for (let i = 0; i < Math.min(length1, length2); i++) {
      let comparison = this.idArray[i].compareTo(other.idArray[i]);
      if (comparison !== 0) return comparison;
    }
    if (length1 < length2) {
      return -1;
    } else if (length1 === length2) {
      return 0;
    } else {
      return 1;
    }
  }
}

export default Char;
