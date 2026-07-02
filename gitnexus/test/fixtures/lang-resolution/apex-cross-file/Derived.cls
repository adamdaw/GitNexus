// Top-level extends/implements across files + super()/super.method() delegation.
public class Derived extends Base implements Iface {
    public Derived() {
        super();
    }
    public override String greet() {
        return super.greet();
    }
    public void act() {}
}
