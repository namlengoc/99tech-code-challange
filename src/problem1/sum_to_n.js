const isValidPositiveInt = (n) => Number.isInteger(n) && n > 0;

var sum_to_n_a = function(n) {
    if (!isValidPositiveInt(n)) return 0;
    return (n * (n + 1)) / 2;
};

var sum_to_n_b = function(n) {
    if (!isValidPositiveInt(n)) return 0;
    let sum = 0;
    for (let i = 1; i <= n; i++) {
        sum += i;
    }
    return sum;
};

var sum_to_n_c = function(n) {
    if (!isValidPositiveInt(n)) return 0;
    if (n === 1) return 1;
    return n + sum_to_n_c(n - 1);
};

console.log(sum_to_n_a(100));
console.log(sum_to_n_b(100));
console.log(sum_to_n_c(100));