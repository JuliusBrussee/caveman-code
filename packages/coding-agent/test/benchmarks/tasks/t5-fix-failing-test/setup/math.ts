export function add(a: number, b: number): number {
	return a + b;
}

export function multiply(a: number, b: number): number {
	return a * b;
}

export function divide(a: number, b: number): number {
	if (b === 0) return 0; // Bug: should throw, not return 0
	return a / b;
}

export function average(numbers: number[]): number {
	if (numbers.length === 0) return 0;
	return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}
