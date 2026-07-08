// Top-level parent in its own file (REQ-007 / REQ-005 delegation targets).
public virtual class Base {
    public Base() {}
    public virtual String greet() { return 'base'; }
    public String inherited() { return 'shared'; }
}
