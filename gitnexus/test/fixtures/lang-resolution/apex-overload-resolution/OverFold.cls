// REQ-008 (i-fold): two COMPETING same-arity overloads of user-defined nested
// types, an argument statically typed `ACCOUNT` (case-varied) -> resolves to
// f(Account) via the Apex-local param-type case-fold. The competing overload
// forces exact-type narrowing, so the fold is genuinely on the resolution path
// (a single overload would bind by name+arity without entering narrowing).
public class OverFold {
    public class Account {}
    public class Contact {}

    public void f(Account a) {}
    public void f(Contact c) {}

    public void caller() {
        ACCOUNT x = new account();   // static type Account, case-varied
        f(x);                        // -> f(Account) via param-type case-fold
    }
}
