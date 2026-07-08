// REQ-008 / §4 "overload disambiguable only by an external/unresolvable arg type":
// the overloads differ by a param type the argument resolves to ONLY as an external
// symbol (sObject/stdlib), so no unique user-defined exact-type match exists -> REQ-015
// unresolved, no throw. (Account/Contact are external sObjects, not user-defined here.)
public class OverExternalArg {
    public void k(Account a) {}
    public void k(Contact c) {}

    public void caller(Account x) {
        k(x);                 // arg type external -> no user-defined exact match -> unresolved
    }
}
