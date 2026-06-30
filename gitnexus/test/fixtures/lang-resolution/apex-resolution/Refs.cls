// REQ-005 (type usage, constructor, field/property access) + REQ-006, all
// case-varied to exercise the normalizeIdentifier seam, within ONE declaration
// unit (top-level Refs + nested Account). SDD-002 §8 illustrative fixture:
// `ACCOUNT a = new account(); a.NAME` against `class Account { String name; }`.
public class Refs {
    public class Account {
        public String name { get; set; }
    }

    public void use() {
        ACCOUNT a = new account();   // type usage (USES Account) + constructor (CALLS Account ctor); case-varied
        String n = a.NAME;           // field/property access (ACCESSES name); case-varied
    }
}
