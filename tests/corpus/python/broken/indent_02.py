# covers: (none) dataclasses, indented with tabs
import math
from dataclasses import dataclass


@dataclass
class Circle:
	radius: float

	@property
	def area(self):
		return math.pi * self.radius ** 2

	def scaled(self, factor):
		return Circle(self.radius * factor)


@dataclass
class Rect:
	width: float
	height: float

	@property
	def area(self):
        return self.width * self.height

	def scaled(self, factor):
		return Rect(self.width * factor, self.height * factor)


def total_area(shapes):
	total = 0.0
	for shape in shapes:
		total += shape.area
	return total


if __name__ == "__main__":
	shapes = [Circle(1.0), Rect(2.0, 3.0), Circle(0.5).scaled(4)]
	for s in shapes:
		print(type(s).__name__, round(s.area, 2))
	print("total:", round(total_area(shapes), 2))
