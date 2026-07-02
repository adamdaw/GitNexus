// Case-varied extension: a correctly-declared trigger in a .TRIGGER file must stay
// EXCLUDED from injection (a literal endsWith('.trigger') would inject it).
trigger Boom on Account (before insert) {
    Integer x = 1;
}
