// A uniquely-bound outer owning a unique nested HInner (for the case-varied-OUTER resolve case)
// and two case-colliding nested tails Dup/DUP (for the ambiguous-nested refuse-on-tie case).
public virtual class HOuter {
    public virtual class HInner {}
    public virtual class Dup {}
    public virtual class DUP {}
}
