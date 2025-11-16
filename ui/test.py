class Animal:
    # Несколько общих массивов
    all_names = []

class Dog(Animal):
    def __init__(self, name, breed):
        super()
        self.name = name
        self.breed = breed
        self.all_names.append(name)
    

class Cat(Animal):
    def __init__(self, name, color):
        super()
        self.name = name
        self.color = color
        self.all_names.append(name)
        
  


dog = Dog("Gaf", "toy")
cat = Cat("Murzic", "black")
print(Dog.all_names, "asdasda")