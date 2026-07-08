// Receiver-variable case-fold, CONSERVATIVE collision arm (SDD-004 §4): two same-folded receiver
// variables (`a`:Widget and `A`:Gadget collide under the folded key 'a'). The receiver-variable fold
// must NOT guess -> A.foo() is an ambiguous receiver -> conservative skip, never mis-bound to either
// Widget.foo or Gadget.foo. (Invalid Apex — duplicate local — exercised for conservative behaviour.)
public class PColl {
    public void go() {
        Widget pa = new Widget();
        Gadget PA = new Gadget();
        Pa.foo();
    }
}
