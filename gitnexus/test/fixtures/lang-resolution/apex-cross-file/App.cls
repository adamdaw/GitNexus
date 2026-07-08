// Two-class cross-file call (REQ-005 ∘ REQ-010) + bare declared-type usage:
// `Engine held` binds cross-file (no standalone edge), observably enabling held.label.
public class App {
    public Engine held;
    public void run() {
        Engine e = new Engine();
        e.start();
    }
    public void touch() {
        String s = held.label;
    }
}
