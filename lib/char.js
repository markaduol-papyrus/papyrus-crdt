class Char {
  constructor(value, siteId, idArray) {
    this.value = value;
    this.siteId = siteId;
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
    if (this.idArray.length < other.idArray.length) {
      return -1;
    } else if (this.idArray.length === other.idArray.length) {
      return 0;
    } else {
      return 1;
    }
  }
}

export default Char;
