// C# global-namespace type occupying the same folded key ('motor') — the peer-ENTRY
// direction: the C# hook writes workspaceFqnBindings, so this entry shares the registry.
public class motor {
    public void Whir() {}
}

public class CsUser {
    public void Go() {
        motor m = new motor();
        m.Whir();
    }
}
