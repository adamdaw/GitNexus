// REQ-009 field/property-access chain across user-defined types, single unit:
// a per-segment ACCESSES edge for EACH access (i.leaf and (i.leaf).value), not
// only the terminal.
public class Chains {
    public class Inner {
        public Leaf leaf { get; set; }
    }
    public class Leaf {
        public String value { get; set; }
    }

    public void chain() {
        Inner i = new Inner();
        String v = i.leaf.value;     // ACCESSES leaf, then ACCESSES value
    }
}
