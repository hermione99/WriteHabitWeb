export const Logo = ({ small, onClick }) => (
  <span className="logo" style={small ? { fontSize: 18 } : {}} onClick={onClick}>
    <span className="w">Write</span>
    <span className="h">Habit</span>
  </span>
);
